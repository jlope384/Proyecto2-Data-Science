// Unidades 3D chibi low-poly (estilo PS1 / Mega Man Legends) con ojos saltones.
//
// Cada [data-unit] trae un <canvas>. Para no abrir un contexto WebGL por
// unidad, hay un solo renderer fuera de pantalla: cada cuadro se renderizan
// todas las unidades visibles en su propio rectángulo del renderer (un atlas)
// y luego se copian a sus canvas con drawImage. Para que corra hasta en una
// tostadora: sin antialias y a un pixel por pixel CSS (los serruchos y los
// pixeles gordos van con el estilo PS1), los cuadros por segundo bajan solos
// si la máquina no da, y como mucho se arma un modelo nuevo por cuadro para
// que el scroll no se trabe. Solo se dibujan las
// unidades visibles (sin ninguna en pantalla el ciclo se detiene), cada
// variante (equipo, sombrero, arma, cara) se arma una sola vez y las demás
// unidades iguales la clonan compartiendo geometría, y las piezas rígidas de
// cada hueso se funden en una sola malla (pocas llamadas de dibujo por
// unidad). Se anima a 30 cuadros por segundo, que además va con el estilo PS1.
//
// Excepción: las unidades con data-solo (las dos del hero, que es lo primero
// que se ve y se mueven por la pantalla con CSS a 60 fps) tienen su propio
// WebGL, se dibujan directo en su canvas sin pasar por el atlas ni drawImage,
// y se actualizan en cada cuadro de la pantalla sin el limitador de fps.
//
// Esqueleto: pelvis → (piernas: muslo → rodilla → espinilla) y
// columna → (brazos: brazo → codo → antebrazo → mano) y cuello → cabeza.
// Los segmentos son cápsulas que se traslapan, así que las articulaciones no
// se ven pero sí se doblan.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  LatheGeometry,
  Material,
  Object3D,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
} from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

type Team = "a" | "b" | "tie";
type Idle = "wobble" | "walk" | "pull";

const INK = "#23202e";
const TEAMS: Record<Team, { base: string; dark: string; light: string }> = {
  a: { base: "#4a85e8", dark: "#2c5cb3", light: "#7ea8f0" },
  b: { base: "#ef6a3f", dark: "#b8452a", light: "#f59a7a" },
  tie: { base: "#a3a8ae", dark: "#6f757c", light: "#c4c8cc" },
};
const GOLD = "#ffc83d";
const METAL = "#c9d0d8";
const WOOD = "#b07a43";
const STRAW = "#f2cf6b";

// ---------- materiales ----------
const mats = new Map<string, MeshLambertMaterial>();
const mat = (color: string, side = 0) => {
  const key = color + side;
  if (!mats.has(key)) {
    const m = new MeshLambertMaterial({ color, flatShading: true, vertexColors: true });
    if (side) m.side = DoubleSide;
    mats.set(key, m);
  }
  return mats.get(key)!;
};
const eyeMat = new MeshLambertMaterial({ color: "#ffffff", flatShading: true, vertexColors: true });
const pupilMat = new MeshBasicMaterial({ color: INK });

// Textura poligonal: se desacomodan un poco los vértices, cada triángulo queda
// plano y con un tono ligeramente distinto. Todo el cuerpo queda cubierto de
// facetas parejas y así no se notan las uniones entre piezas.
function polyfy(m: Mesh, jitter: number, tone: number) {
  const g = m.geometry.clone();
  g.deleteAttribute("normal");
  if (g.getAttribute("uv")) g.deleteAttribute("uv");
  const merged = mergeVertices(g, 1e-4);
  merged.computeVertexNormals();
  // el desplazamiento se mide en el mundo: se compensa la escala de la malla
  const sc = (Math.abs(m.scale.x) + Math.abs(m.scale.y) + Math.abs(m.scale.z)) / 3 || 1;
  const pos = merged.getAttribute("position");
  const nor = merged.getAttribute("normal");
  for (let i = 0; i < pos.count; i++) {
    const d = ((Math.random() - 0.5) * 2 * jitter) / sc;
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * d, pos.getY(i) + nor.getY(i) * d, pos.getZ(i) + nor.getZ(i) * d);
  }
  const flat = merged.toNonIndexed();
  flat.computeVertexNormals();
  const n = flat.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const b = 1 + (Math.random() - 0.5) * 2 * tone;
    colors.fill(b, i * 3, i * 3 + 9);
  }
  flat.setAttribute("color", new BufferAttribute(colors, 3));
  m.geometry = flat;
}
const shadowMat = new MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.18, depthWrite: false });

// Material único para el cuerpo ya horneado: el color de cada pieza va en los
// vértices, así un hueso entero se dibuja de una vez.
const bodyMat = [false, true].map((double) => {
  const m = new MeshLambertMaterial({ color: "#ffffff", flatShading: true, vertexColors: true });
  if (double) m.side = DoubleSide;
  return m;
});
const tint = new Color();

// Funde las piezas rígidas que cuelgan directamente de cada hueso (grupo) en
// una malla por material. Las de `keep` (pupilas) se quedan sueltas porque se
// mueven solas.
function bake(root: Object3D, keep: Set<Mesh>) {
  const bones: Object3D[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh)) bones.push(o);
  });
  for (const bone of bones) {
    const parts = bone.children.filter((o): o is Mesh => o instanceof Mesh && !keep.has(o));
    if (parts.length < 2) continue;
    const buckets = new Map<Material, BufferGeometry[]>();
    for (const m of parts) {
      const src = m.material as MeshLambertMaterial | MeshBasicMaterial;
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "color") g.deleteAttribute(k);
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      let target: Material;
      if (src === pupilMat) {
        target = pupilMat;
        if (g.getAttribute("color")) g.deleteAttribute("color");
      } else {
        target = bodyMat[src.side === DoubleSide ? 1 : 0];
        tint.copy(src.color);
        const tone = g.getAttribute("color");
        const n = g.getAttribute("position").count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const t = tone ? tone.getX(i) : 1;
          col[i * 3] = tint.r * t;
          col[i * 3 + 1] = tint.g * t;
          col[i * 3 + 2] = tint.b * t;
        }
        g.setAttribute("color", new BufferAttribute(col, 3));
      }
      if (!buckets.has(target)) buckets.set(target, []);
      buckets.get(target)!.push(g);
      m.geometry.dispose();
      bone.remove(m);
    }
    for (const [material, geos] of buckets) {
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (merged) bone.add(new Mesh(merged, material));
    }
  }
}

const mesh = (g: BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
  const m = new Mesh(g, mat(color));
  m.position.set(x, y, z);
  return m;
};

const group = (x = 0, y = 0, z = 0) => {
  const g = new Group();
  g.position.set(x, y, z);
  return g;
};

// Cabeza lisa y redonda, apenas más angosta abajo
// cabezota redonda (chibi)
const HEAD = { x: 0.44, y: 0.42, z: 0.41 };
function eggHead() {
  const g = new SphereGeometry(1, 10, 8);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    let [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const taper = y < 0 ? 1 - 0.08 * -y : 1;
    x *= taper;
    z *= y < 0 ? 1 - 0.1 * -y : 1;
    pos.setXYZ(i, x * HEAD.x, y * HEAD.y, z * HEAD.z);
  }
  g.computeVertexNormals();
  return g;
}

// Extremidad que se angosta (r1 arriba, r2 abajo) con puntas redondeadas
function taper(r1: number, r2: number, len: number, color: string) {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 2; i++) {
    const a = (i / 2) * (Math.PI / 2);
    pts.push(new Vector2(Math.sin(a) * r2, -len - Math.cos(a) * r2));
  }
  for (let i = 0; i <= 2; i++) {
    const a = (i / 2) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a) * r1, Math.sin(a) * r1));
  }
  const m = new Mesh(new LatheGeometry(pts, 6), mat(color));
  return m;
}

const ellipsoid = (rx: number, ry: number, rz: number, color: string, x = 0, y = 0, z = 0) => {
  const m = new Mesh(new SphereGeometry(1, 8, 6), mat(color));
  m.scale.set(rx, ry, rz);
  m.position.set(x, y, z);
  return m;
};

interface Opts {
  team: Team;
  hat: string;
  weapon: string;
  mood: string;
  idle: Idle;
}

interface Limb {
  upper: Group;
  lower: Group;
}

interface Model {
  base: Group;
  root: Group;
  pelvis: Group;
  spine: Group;
  neck: Group;
  head: Group;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  pupils: { mesh: Mesh; r: number }[];
}

// Proporciones chibi (~2.3 de alto): cabezota, panza redonda y extremidades
// cortitas y gordas. Alturas en el mundo: pies 0, cadera 0.6, hombros 1.2,
// cabeza de 1.43 a 2.27.
const HIP_Y = 0.6;
const SPINE_Y = 0.05;

// Arma el modelo de referencia de una variante. Los huesos llevan nombre para
// encontrarlos en cada clon.
function build(o: Opts): Group {
  const c = TEAMS[o.team];
  const base = new Group();
  const root = new Group();
  root.name = "root";
  root.rotation.order = "YXZ";
  base.add(root);

  const shadow = new Mesh(new CircleGeometry(0.7, 12), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  base.add(shadow);

  // cadera: la parte baja de la panza, con el color del pantalón
  const pelvis = group(0, HIP_Y, 0);
  pelvis.name = "pelvis";
  root.add(pelvis);
  pelvis.add(ellipsoid(0.46, 0.3, 0.42, c.dark, 0, 0.06, 0));

  // piernitas gorditas con pies redondos
  [-1, 1].forEach((s) => {
    const upper = group(s * 0.2, -0.04, 0);
    upper.name = s < 0 ? "legL" : "legR";
    upper.add(taper(0.17, 0.15, 0.22, c.dark));
    const lower = group(0, -0.22, 0);
    lower.add(taper(0.15, 0.13, 0.18, c.dark));
    lower.add(ellipsoid(0.14, 0.085, 0.2, "#2b2833", 0, -0.27, 0.06));
    lower.name = upper.name + ".lower";
    upper.add(lower);
    pelvis.add(upper);
  });

  // panza redonda
  const spine = group(0, SPINE_Y, 0);
  spine.name = "spine";
  spine.rotation.order = "YXZ";
  pelvis.add(spine);
  spine.add(ellipsoid(0.52, 0.56, 0.48, c.base, 0, 0.38, 0));
  const belt = mesh(new TorusGeometry(0.47, 0.035, 3, 10), c.dark, 0, 0.06, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.92, 1);
  spine.add(belt);

  // globito de chat en la panza: lo que delata que es un chatbot
  const badge = group(0, 0.42, 0.46);
  badge.rotation.x = -0.05;
  badge.scale.setScalar(1.6);
  badge.add(mesh(new BoxGeometry(0.2, 0.13, 0.04), "#ffffff"));
  const tail = mesh(new ConeGeometry(0.03, 0.06, 3), "#ffffff", -0.05, -0.085, 0);
  tail.rotation.z = Math.PI;
  badge.add(tail);
  for (const x of [-0.05, 0, 0.05]) {
    const dot = new Mesh(new SphereGeometry(0.017, 6, 4), pupilMat);
    dot.position.set(x, 0, 0.025);
    badge.add(dot);
  }
  spine.add(badge);

  // bracitos cortos y gordos con manitas redondas
  const arms = [-1, 1].map((s): Limb => {
    const upper = group(s * 0.46, 0.62, 0);
    upper.name = s < 0 ? "armL" : "armR";
    upper.add(ellipsoid(0.15, 0.15, 0.15, c.base));
    upper.add(taper(0.13, 0.12, 0.2, c.base));
    const lower = group(0, -0.2, 0);
    lower.add(taper(0.12, 0.11, 0.15, c.base));
    lower.add(ellipsoid(0.12, 0.12, 0.11, c.light, 0, -0.28, 0));
    lower.name = upper.name + ".lower";
    upper.add(lower);
    spine.add(upper);
    return { upper, lower };
  });
  const hand = group(0, -0.28, 0);
  hand.scale.setScalar(0.75); // armas un poco más chicas para su tamaño
  arms[1].lower.add(hand);
  addWeapon(hand, o.weapon, c.base);

  // sin cuello: la cabezota va directo sobre la panza
  const neck = group(0, 0.85, 0);
  neck.name = "neck";
  spine.add(neck);
  const head = group(0, 0.38, 0.02);
  head.name = "head";
  head.rotation.order = "YXZ";
  head.add(new Mesh(eggHead(), mat(c.base)));
  const wow = o.mood === "wow";
  const pupils = [
    { x: -0.16, y: 0.05, r: 0.15 },
    { x: 0.17, y: 0.065, r: 0.13 },
  ].map(({ x, y, r }) => {
    const eye = new Group();
    const z = HEAD.z * Math.sqrt(Math.max(0, 1 - (x / HEAD.x) ** 2 - (y / HEAD.y) ** 2)) - r * 0.25;
    eye.position.set(x, y, z);
    if (wow) eye.scale.setScalar(1.15);
    const white = new Mesh(new SphereGeometry(r, 8, 6), eyeMat);
    white.userData.poly = "eye";
    eye.add(white);
    const pupil = new Mesh(new SphereGeometry(r * (wow ? 0.36 : 0.48), 6, 4), pupilMat);
    pupil.position.set(0, 0, r * 0.62);
    pupil.name = "pupil";
    pupil.userData.r = r;
    eye.add(pupil);
    head.add(eye);
    if (o.mood === "angry" || o.mood === "sad") {
      const brow = new Mesh(new BoxGeometry(0.17, 0.04, 0.04), pupilMat);
      brow.position.set(x, y + r + 0.05, z + 0.03);
      brow.rotation.z = (o.mood === "angry" ? 0.4 : -0.4) * Math.sign(x);
      head.add(brow);
    }
    return pupil;
  });
  // los sombreros se diseñaron para una esfera de radio ~0.37
  const hat = new Group();
  hat.scale.set(HEAD.x / 0.34, HEAD.y / 0.4, HEAD.z / 0.36);
  addHat(hat, o.hat, c.base);
  head.add(hat);
  neck.add(head);

  // facetas planas estilo PS1 (Mega Man Legends) en todo el cuerpo y accesorios
  root.traverse((obj) => {
    if (!(obj instanceof Mesh) || obj.material === pupilMat) return;
    if (obj.userData.poly === "eye") polyfy(obj, 0, 0.02);
    else polyfy(obj, 0.004, 0.04);
  });
  bake(root, new Set(pupils));
  // siempre están en cuadro y casi nada se mueve fuera de los huesos: sin
  // frustum culling ni recalcular matrices locales de las mallas fijas
  base.traverse((obj) => {
    obj.frustumCulled = false;
    if (obj instanceof Mesh && obj.name !== "pupil") {
      obj.updateMatrix();
      obj.matrixAutoUpdate = false;
    }
  });
  return base;
}

// Las unidades iguales comparten geometría y materiales: solo se clonan los
// nodos, que cada una anima por su cuenta.
const templates = new Map<string, Group>();
const variant = (o: Opts) => `${o.team}|${o.hat}|${o.weapon}|${o.mood}`;
function instance(o: Opts): Model {
  const key = variant(o);
  let tpl = templates.get(key);
  if (!tpl) templates.set(key, (tpl = build(o)));
  const base = tpl.clone();
  const bone = (name: string) => base.getObjectByName(name) as Group;
  const limb = (name: string): Limb => ({ upper: bone(name), lower: bone(name + ".lower") });
  const pupils: Model["pupils"] = [];
  base.traverse((obj) => {
    if (obj instanceof Mesh && obj.name === "pupil") pupils.push({ mesh: obj, r: obj.userData.r });
  });
  return {
    base,
    root: bone("root"),
    pelvis: bone("pelvis"),
    spine: bone("spine"),
    neck: bone("neck"),
    head: bone("head"),
    armL: limb("armL"),
    armR: limb("armR"),
    legL: limb("legL"),
    legR: limb("legR"),
    pupils,
  };
}

// Sombreros: siempre por encima de la línea de los ojos
function addHat(head: Group, hat: string, team: string) {
  if (hat === "crown") {
    const ring = mesh(new CylinderGeometry(0.21, 0.23, 0.13, 6, 1, true), GOLD, 0, 0.37, 0);
    ring.material = mat(GOLD, 1);
    head.add(ring);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      head.add(mesh(new ConeGeometry(0.045, 0.13, 4), GOLD, Math.cos(a) * 0.2, 0.49, Math.sin(a) * 0.2));
    }
  }
  if (hat === "helmet" || hat === "viking") {
    head.add(mesh(new SphereGeometry(0.4, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.34), METAL, 0, 0.08, 0));
    if (hat === "helmet") {
      const plume = mesh(new ConeGeometry(0.07, 0.32, 4), team, 0, 0.55, -0.04);
      plume.rotation.x = -0.45;
      head.add(plume);
    } else {
      for (const s of [-1, 1]) {
        const horn = mesh(new ConeGeometry(0.07, 0.34, 5), "#fff4dc", s * 0.38, 0.36, 0);
        horn.rotation.z = -s * 0.95;
        head.add(horn);
      }
    }
  }
  if (hat === "straw") {
    head.add(mesh(new CylinderGeometry(0.6, 0.6, 0.035, 8), STRAW, 0, 0.32, 0));
    head.add(mesh(new CylinderGeometry(0.24, 0.28, 0.2, 6), STRAW, 0, 0.43, 0));
    head.add(mesh(new CylinderGeometry(0.287, 0.287, 0.05, 6), "#b8452a", 0, 0.355, 0));
  }
}

function addWeapon(hand: Group, weapon: string, team: string) {
  const g = new Group();
  if (weapon === "sword") {
    g.add(mesh(new BoxGeometry(0.07, 0.8, 0.03), "#eef2f6", 0, 0.52, 0));
    g.add(mesh(new BoxGeometry(0.3, 0.05, 0.08), "#7d8691", 0, 0.1, 0));
    g.add(mesh(new CylinderGeometry(0.028, 0.028, 0.16, 5), WOOD, 0, 0, 0));
    g.rotation.z = -0.25;
  }
  if (weapon === "club") {
    g.add(mesh(new CylinderGeometry(0.13, 0.05, 0.8, 6), WOOD, 0, 0.38, 0));
    g.rotation.set(0.3, 0, -0.35);
  }
  if (weapon === "flag") {
    g.add(mesh(new CylinderGeometry(0.028, 0.028, 2.0, 5), WOOD, 0, 0.75, 0));
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.48, -0.13);
    shape.lineTo(0, -0.28);
    const flag = new Mesh(new ShapeGeometry(shape), mat(team, 1));
    flag.position.set(0.02, 1.72, 0);
    g.add(flag);
    g.rotation.z = -0.22;
  }
  if (weapon === "scroll") {
    g.add(mesh(new BoxGeometry(0.42, 0.58, 0.015), "#fffdf5", 0.17, -0.3, 0.12));
    const roller = mesh(new CylinderGeometry(0.03, 0.03, 0.48, 5), WOOD, 0.17, 0, 0.12);
    roller.rotation.z = Math.PI / 2;
    g.add(roller);
    for (let k = 0; k < 5; k++) {
      g.add(mesh(new BoxGeometry(k % 2 ? 0.22 : 0.3, 0.014, 0.004), "#a3a8ae", 0.17 - (k % 2 ? 0.04 : 0), -0.1 - k * 0.09, 0.13));
    }
  }
  hand.add(g);
}

// ---------- estado y animación ----------
type Action = "wave" | "stretch" | "shrug" | "scratch" | "look";
const ACTIONS: Action[] = ["wave", "stretch", "shrug", "scratch", "look"];

interface Unit {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  solo: WebGLRenderer | null; // renderer propio de las unidades data-solo
  drawn: number; // último cuadro dibujado (ms), para suavizar según el tiempo
  opts: Opts;
  model: Model | null;
  idle: Idle;
  armed: boolean;
  phase: number;
  w: number;
  h: number;
  visible: boolean;
  hover: boolean;
  flipped: boolean;
  ragdoll: number;
  action: { type: Action; start: number; dur: number } | null;
  nextAction: number;
  look: { x: number; y: number; tx: number; ty: number };
}

const RAGDOLL_MS = 1500;
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeOutBack = (x: number) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
// curva de entrada/salida para mezclar una acción con el reposo
const envelope = (p: number) => (p < 0.2 ? easeOut(p / 0.2) : p > 0.8 ? easeOut((1 - p) / 0.2) : 1);

function setLimb(l: Limb, ux: number, uz: number, lx: number, uy = 0) {
  l.upper.rotation.set(ux, uy, uz);
  l.lower.rotation.set(lx, 0, 0);
}

function pose(u: Unit, m: Model, now: number) {
  const t = now / 1000 + u.phase;
  const { root, pelvis, spine, neck, head, armL, armR, legL, legR } = m;

  // ---------- reposo / caminar / jalar ----------
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0.35, 0);
  pelvis.position.set(0, HIP_Y, 0);
  pelvis.rotation.set(0, 0, 0);
  spine.rotation.set(0, 0, 0);
  neck.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  spine.scale.set(1, 1, 1);

  if (u.idle === "wobble") {
    // carga el peso de un pie al otro y respira
    const shift = Math.sin(t * 0.9);
    pelvis.position.x = shift * 0.05;
    pelvis.rotation.z = shift * 0.05;
    spine.rotation.z = -shift * 0.07;
    spine.rotation.x = Math.sin(t * 1.3) * 0.03;
    spine.scale.y = 1 + Math.sin(t * 2.4) * 0.015;
    setLimb(legL, 0, 0.02 - Math.max(0, shift) * 0.04, Math.max(0, -shift) * 0.18);
    setLimb(legR, 0, -0.02 - Math.max(0, -shift) * 0.04, Math.max(0, shift) * 0.18);
    pelvis.position.y = HIP_Y - Math.abs(shift) * 0.02;
    setLimb(armL, Math.sin(t * 1.1) * 0.06, -0.42 - shift * 0.03, -0.18 - Math.sin(t * 1.1 + 1) * 0.05);
    setLimb(armR, Math.sin(t * 1.1 + 2) * 0.06, 0.42 - shift * 0.03, u.armed ? -0.55 : -0.18 - Math.sin(t * 1.1) * 0.05);
  } else if (u.idle === "walk") {
    const w = t * 11;
    root.rotation.y = 0.9;
    pelvis.position.y = HIP_Y + Math.abs(Math.cos(w)) * 0.06 - 0.03;
    pelvis.rotation.y = Math.sin(w) * 0.12;
    spine.rotation.y = -Math.sin(w) * 0.2;
    spine.rotation.x = 0.08;
    setLimb(legL, -Math.sin(w) * 0.6, 0, Math.max(0, Math.sin(w + 1.2)) * 0.9);
    setLimb(legR, Math.sin(w) * 0.6, 0, Math.max(0, -Math.sin(w + 1.2)) * 0.9);
    setLimb(armL, Math.sin(w) * 0.45, -0.4, -0.35 - Math.max(0, Math.sin(w)) * 0.3);
    setLimb(armR, -Math.sin(w) * 0.45, 0.4, -0.35 - Math.max(0, -Math.sin(w)) * 0.3);
    head.rotation.z = Math.sin(w + 1) * 0.04;
  } else {
    // jalando la cuerda: rodillas dobladas, cuerpo atrás, brazos al frente
    const p = Math.sin(t * 6);
    root.rotation.y = 1.15;
    pelvis.position.y = HIP_Y - 0.12;
    pelvis.position.z = -0.1;
    pelvis.rotation.x = -0.25 + p * 0.03;
    spine.rotation.x = -0.1;
    setLimb(legL, -0.55, 0, 0.8);
    setLimb(legR, 0.05, 0, 0.4);
    setLimb(armL, -1.45 + p * 0.06, 0.12, -0.25);
    setLimb(armR, -1.45 + p * 0.06, -0.12, -0.25);
    head.rotation.x = 0.2;
  }

  // ---------- acciones al azar mientras están quietas ----------
  if (u.idle === "wobble" && !u.ragdoll) {
    if (!u.action && now > u.nextAction) {
      const type = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
      u.action = { type, start: now, dur: type === "look" ? 2600 : 2000 };
    }
    if (u.action) {
      const p = (now - u.action.start) / u.action.dur;
      if (p >= 1) {
        u.action = null;
        u.nextAction = now + 3500 + Math.random() * 6000;
      } else {
        const e = envelope(p);
        const k = (now - u.action.start) / 1000;
        switch (u.action.type) {
          case "wave":
            armL.upper.rotation.z += -2.5 * e;
            armL.lower.rotation.x += (-0.6 + Math.sin(k * 12) * 0.5) * e;
            armL.lower.rotation.z = Math.sin(k * 12) * 0.5 * e;
            spine.rotation.z += 0.08 * e;
            head.rotation.z += 0.12 * e;
            break;
          case "stretch":
            armL.upper.rotation.z += -2.7 * e;
            armR.upper.rotation.z += 2.7 * e;
            armL.lower.rotation.x *= 1 - e;
            armR.lower.rotation.x *= 1 - e;
            spine.rotation.x += -0.15 * e;
            spine.scale.y += 0.04 * e;
            head.rotation.x += -0.3 * e;
            break;
          case "shrug":
            armL.upper.rotation.z += -0.45 * e;
            armR.upper.rotation.z += 0.45 * e;
            armL.lower.rotation.x += -1.2 * e;
            armR.lower.rotation.x += -1.2 * e;
            armL.lower.rotation.y = -0.6 * e;
            spine.position.y = SPINE_Y + 0.03 * e;
            head.rotation.z += 0.22 * e;
            break;
          case "scratch":
            armL.upper.rotation.z += -2.3 * e;
            armL.upper.rotation.x += -0.4 * e;
            armL.lower.rotation.x += (-1.7 + Math.sin(k * 20) * 0.15) * e;
            head.rotation.z += -0.15 * e;
            head.rotation.x += 0.12 * e;
            break;
          case "look":
            head.rotation.y += Math.sin(p * Math.PI * 2) * 0.8 * e;
            spine.rotation.y += Math.sin(p * Math.PI * 2) * 0.25 * e;
            break;
        }
      }
    }
  }
  if (!u.action || u.action.type !== "shrug") spine.position.y = SPINE_Y;

  // la cabeza también voltea hacia el cursor
  head.rotation.y += u.look.x * 0.45;
  head.rotation.x += u.look.y * 0.25;

  // nervioso al pasar el mouse
  if (u.hover && !u.ragdoll) {
    root.rotation.z += (Math.random() - 0.5) * 0.08;
    head.rotation.z += (Math.random() - 0.5) * 0.15;
  }

  // ---------- ragdoll: salta, cae de espaldas, rebota y se levanta ----------
  if (u.ragdoll) {
    const p = (now - u.ragdoll) / RAGDOLL_MS;
    if (p >= 1) {
      u.ragdoll = 0;
    } else {
      let fall: number;
      if (p < 0.33) {
        const e = easeOut(p / 0.33);
        fall = -1.45 * e;
        root.position.y = Math.sin(e * Math.PI) * 0.55;
      } else if (p < 0.62) {
        fall = -1.45 + Math.sin((p - 0.33) * 30) * 0.08 * (0.62 - p) * 3;
      } else {
        fall = -1.45 * (1 - easeOutBack((p - 0.62) / 0.38));
      }
      root.rotation.x = fall;
      root.rotation.z = Math.sin(p * 9) * 0.15 * (1 - p);
      const amp = 1 - p;
      const k = now / 1000;
      const flop = (f: number, o: number) => Math.sin(k * f + o) * amp;
      setLimb(armL, flop(21, 0) * 1.1, -0.2 - Math.abs(flop(17, 1)) * 1.2, -Math.abs(flop(23, 2)) * 1.4);
      setLimb(armR, flop(21, 2) * 1.1, 0.2 + Math.abs(flop(15, 0)) * 1.2, -Math.abs(flop(19, 1)) * 1.4);
      setLimb(legL, flop(19, 0) * 0.8, -Math.abs(flop(13, 2)) * 0.3, Math.abs(flop(25, 1)) * 1.2);
      setLimb(legR, flop(19, 1.5) * 0.8, Math.abs(flop(14, 0)) * 0.3, Math.abs(flop(22, 2)) * 1.2);
      spine.rotation.x = flop(16, 0) * 0.35;
      spine.rotation.z = flop(12, 1) * 0.3;
      neck.rotation.x = flop(24, 2) * 0.5;
      head.rotation.z = flop(25, 0) * 0.5;
    }
  }

  // pupilas: se suavizan hacia donde está el cursor según el tiempo, así se
  // mueven igual a 10, 30 o 60 fps (k = 0.28 a 30 fps, como antes)
  const dt = u.drawn ? Math.min(now - u.drawn, 100) : 1000 / 30;
  u.drawn = now;
  const k = 1 - Math.exp(-dt / 100);
  u.look.x += (u.look.tx - u.look.x) * k;
  u.look.y += (u.look.ty - u.look.y) * k;
  for (const { mesh: p, r } of m.pupils) {
    p.position.set(u.look.x * r * 0.4, -u.look.y * r * 0.4, r * 0.62);
  }
}

// ---------- arranque ----------
// cuadros por segundo según lo que aguante la máquina
const FPS_STEPS = [30, 20, 15, 10];

function init() {
  const els = [...document.querySelectorAll<HTMLElement>("[data-unit]")];
  if (!els.length) return;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: false, alpha: true, stencil: false, powerPreference: "low-power" });
  } catch {
    return; // sin WebGL: las unidades simplemente no aparecen
  }
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(true);
  renderer.sortObjects = false; // la única transparente (la sombra) igual va al final

  const scene = new Scene();
  scene.add(new HemisphereLight("#ffffff", "#8a7d6e", 1.7));
  const sun = new DirectionalLight("#fff6e8", 1.6);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const fill = new DirectionalLight("#dbe9ff", 0.6);
  fill.position.set(-4, 2, 3);
  scene.add(fill);

  // encuadre: de los pies (0) a la punta del sombrero (~2.6)
  const camera = new PerspectiveCamera(21, 100 / 115, 0.1, 50);
  camera.position.set(0, 1.6, 7.9);
  camera.lookAt(0, 1.25, 0);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = 1;
  const start = performance.now();

  const soloRenderer = (canvas: HTMLCanvasElement) => {
    try {
      const r = new WebGLRenderer({ canvas, antialias: false, alpha: true, stencil: false, powerPreference: "low-power" });
      r.setPixelRatio(1);
      r.setClearColor(0x000000, 0);
      r.sortObjects = false;
      return r;
    } catch {
      return null; // sin otro contexto disponible: se dibuja por el atlas
    }
  };

  const units: Unit[] = els.map((el, i) => {
    const canvas = el.querySelector("canvas")!;
    // un canvas solo admite un tipo de contexto: WebGL propio o 2D para el atlas
    const solo = "solo" in el.dataset ? soloRenderer(canvas) : null;
    const d = el.dataset;
    const opts: Opts = {
      team: (d.team as Team) || "a",
      hat: d.hat || "none",
      weapon: d.weapon || "none",
      mood: d.mood || "happy",
      idle: (d.idle as Idle) || "wobble",
    };
    return {
      el,
      canvas,
      ctx: solo ? null : canvas.getContext("2d")!,
      solo,
      drawn: 0,
      opts,
      model: null,
      idle: opts.idle,
      armed: opts.weapon !== "none",
      phase: i * 1.37,
      w: 0,
      h: 0,
      visible: false,
      hover: false,
      flipped: false,
      ragdoll: 0,
      action: null,
      nextAction: start + 1500 + ((i * 2311) % 7000),
      look: { x: 0, y: 0, tx: 0, ty: 0 },
    };
  });
  const byEl = new Map(units.map((u) => [u.el, u]));

  // Tamaños: el canvas usa el tamaño de layout (ignora transforms y volteos)
  const measure = () => {
    for (const u of units) {
      const w = Math.max(1, Math.round(u.el.clientWidth * dpr));
      const h = Math.max(1, Math.round(u.el.clientHeight * dpr));
      // cambiar el tamaño borra el canvas: solo si de verdad cambió
      if (w !== u.w || h !== u.h) {
        u.w = w;
        u.h = h;
        if (u.solo) u.solo.setSize(w, h, false);
        else {
          u.canvas.width = w;
          u.canvas.height = h;
        }
      }
      u.flipped = getComputedStyle(u.el).scale.trim().startsWith("-");
    }
  };
  // se vuelve a medir cuando cambia el tamaño de alguna (ventana, o una
  // unidad que estaba oculta y aparece)
  let resizing = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(resizing);
    resizing = requestAnimationFrame(measure);
  });
  units.forEach((u) => ro.observe(u.el));
  measure();

  // Atlas: las unidades se acomodan en filas dentro del renderer. El buffer
  // solo crece (cambiarle el tamaño cada cuadro sería caro).
  const ATLAS_W = Math.min(2048, renderer.capabilities.maxTextureSize);
  let bufW = 1;
  let bufH = 1;
  const slots: { u: Unit; x: number; y: number }[] = [];
  // devuelve cuántas variantes nuevas armó
  const draw = (list: Unit[], now: number) => {
    slots.length = 0;
    let x = 0;
    let y = 0;
    let row = 0;
    let w = 1;
    let builds = 0;
    for (const u of list) {
      if (!u.model) {
        // armar una variante nueva es lo caro: una por cuadro
        if (!templates.has(variant(u.opts)) && builds++) continue;
        u.model = instance(u.opts);
      }
      if (x > 0 && x + u.w > ATLAS_W) {
        x = 0;
        y += row;
        row = 0;
      }
      slots.push({ u, x, y });
      x += u.w;
      row = Math.max(row, u.h);
      w = Math.max(w, x);
    }
    const h = Math.max(1, y + row);
    if (w > bufW || h > bufH) {
      bufW = Math.max(bufW, w);
      bufH = Math.max(bufH, h);
      renderer.setSize(bufW, bufH, false);
    }
    for (const { u, x, y } of slots) {
      pose(u, u.model!, now);
      scene.add(u.model!.base);
      // el viewport de WebGL empieza abajo a la izquierda
      renderer.setViewport(x, bufH - y - u.h, u.w, u.h);
      renderer.setScissor(x, bufH - y - u.h, u.w, u.h);
      renderer.render(scene, camera); // autoClear limpia solo el scissor
      scene.remove(u.model!.base);
    }
    for (const { u, x, y } of slots) {
      u.ctx!.clearRect(0, 0, u.w, u.h);
      u.ctx!.drawImage(renderer.domElement, x, y, u.w, u.h, 0, 0, u.w, u.h);
    }
    return builds;
  };

  // Unidades data-solo: directo a su propio canvas, sin atlas ni copia
  const drawSolo = (u: Unit, now: number) => {
    if (!u.model) u.model = instance(u.opts);
    pose(u, u.model, now);
    scene.add(u.model.base);
    u.solo!.render(scene, camera);
    scene.remove(u.model.base);
  };
  const paint = (u: Unit, now: number) => (u.solo ? drawSolo(u, now) : draw([u], now));

  // Solo se dibujan las que están en pantalla (y se arman al aparecer)
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const u = byEl.get(e.target as HTMLElement)!;
        u.visible = e.isIntersecting;
        if (!u.visible) u.drawn = 0; // al volver no hay un salto en la mirada
        else if (reduced) paint(u, 0);
      }
      wake();
    },
    { rootMargin: "120px 0px" },
  );
  units.forEach((u) => io.observe(u.el));

  // Interacción: hover, click (ragdoll) y ojos/cabeza que siguen al cursor
  let lastMove = 0;
  let pointer: { x: number; y: number } | null = null;
  for (const u of units) {
    u.el.addEventListener("pointerenter", () => (u.hover = true));
    u.el.addEventListener("pointerleave", () => (u.hover = false));
    u.el.addEventListener("click", () => {
      if (!u.ragdoll) u.ragdoll = performance.now();
      u.action = null;
      if (reduced) paint(u, 0);
    });
  }
  // solo se guarda la posición; la mirada se calcula una vez por cuadro
  addEventListener(
    "pointermove",
    (e) => {
      lastMove = performance.now();
      pointer = { x: e.clientX, y: e.clientY };
    },
    { passive: true },
  );
  const aim = () => {
    if (!pointer) return;
    for (const u of units) {
      if (!u.visible) continue;
      const r = u.el.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height * 0.15);
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 60);
      u.look.tx = (dx / len) * k * (u.flipped ? -1 : 1);
      u.look.ty = (dy / len) * k;
    }
    pointer = null;
  };

  // El ciclo solo corre mientras haya alguna unidad en pantalla
  let last = 0;
  let raf = 0;
  let level = 0;
  let cost = 0;
  let changed = 0;
  const visible: Unit[] = [];
  const shared: Unit[] = [];
  function wake() {
    if (!reduced && !raf && units.some((u) => u.visible)) raf = requestAnimationFrame(loop);
  }
  function loop(now: number) {
    visible.length = 0;
    for (const u of units) if (u.visible) visible.push(u);
    if (!visible.length) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
    aim();
    // sin cursor un rato: miran de un lado a otro solos
    if (now - lastMove > 2500) {
      for (const u of visible) {
        u.look.tx = Math.sin(now / 1300 + u.phase) * 0.7;
        u.look.ty = Math.sin(now / 1700 + u.phase * 2) * 0.25;
      }
    }
    // las del hero van en cada cuadro de la pantalla
    shared.length = 0;
    for (const u of visible) {
      if (u.solo) drawSolo(u, now);
      else shared.push(u);
    }
    // el resto, por el atlas y con el limitador de fps
    if (!shared.length || now - last < 1000 / FPS_STEPS[level] - 2) return;
    last = now;
    const t0 = performance.now();
    // los cuadros donde se armó un modelo no cuentan para medir
    if (!draw(shared, now)) adapt(performance.now() - t0, now);
  }

  // Si dibujar se come mucho del cuadro se baja de fps, y si sobra se sube.
  // Se mide con promedio móvil y se espera un rato entre cambios.
  function adapt(ms: number, now: number) {
    cost = cost ? cost * 0.9 + ms * 0.1 : ms;
    if (now - changed < 2000) return;
    const budget = 1000 / FPS_STEPS[level];
    if (cost > budget * 0.35 && level < FPS_STEPS.length - 1) level++;
    else if (cost < budget * 0.1 && level > 0) level--;
    else return;
    changed = now;
  }
}

init();
