// Genera entregables/Presentacion_Resultados_ChatbotArena.pptx
// Uso: node generar_presentacion.js <ruta_raiz_repo> <ruta_skill_pptx_apply_theme.js opcional>
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = process.argv[2] || path.resolve(__dirname, "..", "..");
const APPLY_THEME = process.argv[3];
const IMG = (p) => path.join(ROOT, p);
const OUT = path.join(ROOT, "entregables", "Presentacion_Resultados_ChatbotArena.pptx");

const THEME = {
  name: "Chatbot Arena",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1F2933", lt1: "FFFFFF", dk2: "1D3557", lt2: "F3F5F9",
    accent1: "2E6FBA", accent2: "E8833A", accent3: "9AA0A6",
    accent4: "6A4C93", accent5: "1B998B", accent6: "B0893B",
    hlink: "2E4A70", folHlink: "6A4C93",
  },
};
const HEX = { navy: "1D3557", gold: "B0893B", A: "2E6FBA", B: "E8833A", tie: "9AA0A6",
  tfidf: "6A4C93", hgb: "1B998B", hgb0: "7FCDC4", lr: "4A6FA5", base: "BDBDBD", muted: "5B6B7F", grid: "E3E7ED" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "Resultados — Chatbot Arena";
pres.author = "Grupo 5";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- Layouts ----------
pres.defineSlideMaster({
  title: "PORTADA",
  background: { color: HEX.navy },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.9, y: 2.3, w: 11.5, h: 1.2,
      fontSize: 44, bold: true, color: C.background1, align: "center", valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 1.4, y: 3.5, w: 10.5, h: 0.9,
      fontSize: 20, color: "CADCFC", align: "center", valign: "top" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENIDO",
  background: { color: "FFFFFF" },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: 0.6, y: 0.3, w: 10, h: 0.35,
      fontSize: 12, bold: true, color: HEX.gold, charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.65, w: 12.1, h: 0.8,
      fontSize: 32, bold: true, color: C.text2, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
  slideNumber: { x: 12.4, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: "8592A3" },
});

const sections = {};
function slide(kicker, title, section) {
  if (!sections[section]) { pres.addSection({ title: section }); sections[section] = true; }
  const s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: section });
  s.addText(kicker.toUpperCase(), { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  return s;
}
function card(s, x, y, w, h, name) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, objectName: name,
    fill: { color: C.background2 }, line: { color: "E3E7ED", width: 0.75 } });
}
function stat(s, x, y, w, value, label, color) {
  card(s, x, y, w, 1.35, "tarjeta " + label);
  s.addText(value, { x, y: y + 0.12, w, h: 0.7, fontSize: 34, bold: true, color: color || C.text2,
    align: "center", isTextBox: true, margin: 0 });
  s.addText(label, { x: x + 0.15, y: y + 0.82, w: w - 0.3, h: 0.45, fontSize: 12, color: HEX.muted,
    align: "center", valign: "top", isTextBox: true, margin: 0 });
}
function bullets(s, items, opts) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
    Object.assign({ fontSize: 16, color: C.text1, paraSpaceAfter: 8, valign: "top", isTextBox: true }, opts));
}
function caption(s, text, x, y, w) {
  s.addText(text, { x, y, w, h: 0.35, fontSize: 11, italic: true, color: HEX.muted, isTextBox: true, margin: 0 });
}
const axis = { catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontSize: 12,
  valAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  valGridLine: { color: HEX.grid, size: 0.75 }, catGridLine: { style: "none" },
  dataLabelFontFace: "+mn-lt", dataLabelFontSize: 11, dataLabelColor: "1F2933",
  titleFontFace: "+mn-lt", titleFontSize: 14, titleColor: HEX.navy, legendFontFace: "+mn-lt", legendFontSize: 11 };

// ---------- 1. Portada ----------
pres.addSection({ title: "Portada" }); sections["Portada"] = true;
let s = pres.addSlide({ masterName: "PORTADA", sectionTitle: "Portada" });
s.addText("UNIVERSIDAD DEL VALLE DE GUATEMALA  ·  CIENCIA DE DATOS", { x: 0.9, y: 1.2, w: 11.5, h: 0.4,
  fontSize: 13, color: "9FB3CC", align: "center", charSpacing: 3, isTextBox: true });
s.addText("¿Quién gana la batalla?", { placeholder: "title" });
s.addText("Predicción de la preferencia humana en Chatbot Arena: modelos, resultados y aplicación", { placeholder: "body" });
s.addShape(pres.shapes.RECTANGLE, { x: 6.17, y: 4.6, w: 1.0, h: 0.06, fill: { color: HEX.gold }, line: { type: "none" }, objectName: "separador" });
s.addText([
  { text: "Javier López · Pedro Ávila · Brandon Rivera", options: { breakLine: true } },
  { text: "Grupo 5  ·  Proyecto 2 – Reto 10  ·  18 de octubre de 2026" },
], { x: 0.9, y: 5.1, w: 11.5, h: 0.9, fontSize: 15, color: "E6ECF5", align: "center", isTextBox: true });
s.addNotes("Presentación de resultados del Proyecto 2: del análisis exploratorio pasamos a modelos predictivos y a una aplicación interactiva.");

// ---------- 2. Agenda ----------
s = slide("Contenido", "Agenda", "Introducción");
const agenda = [["1", "Problema y objetivos"], ["2", "Qué dice la literatura"], ["3", "Datos y lo que aprendimos del EDA"],
  ["4", "Metodología y modelos"], ["5", "Resultados y comparación"], ["6", "La aplicación"], ["7", "Conclusiones"]];
agenda.forEach(([n, t], i) => {
  const y = 1.75 + i * 0.72;
  s.addShape(pres.shapes.OVAL, { x: 0.9, y, w: 0.5, h: 0.5, fill: { color: i % 2 ? C.accent6 : C.text2 }, line: { type: "none" }, objectName: "num " + n });
  s.addText(n, { x: 0.9, y, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(t, { x: 1.65, y, w: 6, h: 0.5, fontSize: 20, color: C.text1, valign: "middle", isTextBox: true, margin: 0 });
});
s.addImage({ path: IMG("entregables/capturas_app/app_3_predecir.png"), x: 7.9, y: 1.7, w: 4.8, h: 4.9,
  sizing: { type: "cover", w: 4.8, h: 4.9 }, objectName: "vista de la app" });

// ---------- 3. Problema y objetivos ----------
s = slide("1 · Problema", "Predecir el voto humano: A, B o empate", "Introducción");
card(s, 0.6, 1.75, 5.6, 3.9, "problema");
s.addText([
  { text: "El problema", options: { bold: true, color: HEX.navy, fontSize: 20, breakLine: true } },
  { text: "Dado un prompt y dos respuestas de LLM anónimos, estimar la probabilidad de que una persona prefiera ", options: {} },
  { text: "A", options: { bold: true, color: HEX.A } }, { text: ", ", options: {} },
  { text: "B", options: { bold: true, color: HEX.B } }, { text: " o declare ", options: {} },
  { text: "empate", options: { bold: true, color: "6F757B", breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "Clasificación multiclase probabilística de PLN. Métrica: log loss (la de Kaggle). Azar = ln 3 ≈ 1.099.", options: {} },
], { x: 0.9, y: 1.95, w: 5.0, h: 3.5, fontSize: 18, color: C.text1, valign: "top", isTextBox: true });
s.addText("Objetivos específicos", { x: 6.7, y: 1.75, w: 6, h: 0.45, fontSize: 20, bold: true, color: C.text2, isTextBox: true, margin: 0 });
bullets(s, [
  "Revisar la literatura para elegir algoritmos",
  "Limpiar los datos y derivar variables del texto",
  "Entrenar, ajustar y comparar ≥ 3 modelos en un conjunto de prueba",
  "Construir una app para explorar datos, predecir y ver el rendimiento",
], { x: 6.7, y: 2.3, w: 6.0, h: 3.5, fontSize: 18, paraSpaceAfter: 12 });

// ---------- 4. Literatura ----------
s = slide("2 · Revisión bibliográfica", "La literatura apunta a dos fuentes de señal", "Introducción");
const lit = [
  ["Sesgos del votante", "Zheng et al. (2023); Wang et al. (2024)", "Las personas y los LLM jueces prefieren respuestas largas, con formato y en cierta posición.", "→ Variables de longitud y formato, comparativas A − B", HEX.A],
  ["Contenido del texto", "Ouyang et al. (2022); Salton & Buckley (1988)", "Los modelos de recompensa aprenden de comparaciones humanas; el contenido se representa con TF-IDF o transformers.", "→ Regresión logística con TF-IDF, calibrada", HEX.tfidf],
  ["No linealidad", "Friedman (2001); Ke et al. (2017)", "El gradient boosting por histogramas captura interacciones entre variables con poco costo.", "→ HistGradientBoosting con GridSearchCV", HEX.hgb],
];
lit.forEach(([h, ref, txt, use, col], i) => {
  const x = 0.6 + i * 4.1;
  card(s, x, 1.75, 3.85, 4.6, "literatura " + h);
  s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: 2.0, w: 0.55, h: 0.55, fill: { color: col }, line: { type: "none" }, objectName: "icono " + h });
  s.addText(String(i + 1), { x: x + 0.3, y: 2.0, w: 0.55, h: 0.55, fontSize: 18, bold: true, color: "FFFFFF", align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(h, { x: x + 1.0, y: 2.0, w: 2.7, h: 0.55, fontSize: 19, bold: true, color: C.text2, valign: "middle", isTextBox: true, margin: 0 });
  s.addText(ref, { x: x + 0.3, y: 2.75, w: 3.3, h: 0.5, fontSize: 12, italic: true, color: HEX.muted, isTextBox: true, margin: 0 });
  s.addText(txt, { x: x + 0.3, y: 3.3, w: 3.3, h: 1.7, fontSize: 15, color: C.text1, valign: "top", isTextBox: true, margin: 0 });
  s.addText(use, { x: x + 0.3, y: 5.15, w: 3.3, h: 1.0, fontSize: 14, bold: true, color: col, valign: "top", isTextBox: true, margin: 0 });
});
caption(s, "Los transformers ajustados (BERT, DeBERTa, LLM + LoRA) son el estado del arte, pero requieren GPU: quedan como trabajo futuro.", 0.6, 6.55, 12.1);

// ---------- 5. Datos ----------
s = slide("3 · Datos", "57 mil batallas reales, 18 variables derivadas", "Datos");
stat(s, 0.6, 1.75, 2.85, "57,470", "batallas tras quitar 7 duplicados");
stat(s, 3.65, 1.75, 2.85, "18", "variables de longitud, formato y turnos");
stat(s, 6.7, 1.75, 2.85, "45,976", "batallas de entrenamiento (80%)");
stat(s, 9.75, 1.75, 2.95, "11,494", "batallas de prueba (20%, estratificado)");
bullets(s, [
  "Texto en JSON por turno → decodificado; objetivo winner ∈ {A, B, empate} (34.9% / 34.2% / 30.9%)",
  "Variables comparativas al estilo Bradley–Terry: len_diff, len_ratio = log(len A / len B), fmt_diff, a_is_longer…",
  "TF-IDF de 1–2 gramas para A y B (20,000 rasgos cada una) y variables estandarizadas",
  "La identidad del modelo NO se usa: no está disponible al predecir",
], { x: 0.6, y: 3.45, w: 12.1, h: 3.2 });

// ---------- 6. EDA ----------
s = slide("3 · Lo que aprendimos del EDA", "La respuesta más larga suele ganar", "Datos");
s.addImage({ path: IMG("web/public/figs/verbosidad.png"), x: 0.6, y: 2.2, w: 8.2, h: 2.57, objectName: "sesgo de verbosidad" });
stat(s, 9.2, 1.75, 3.5, "61.5%", "gana la más larga (sin empates)", HEX.A);
stat(s, 9.2, 3.3, 3.5, "68.7%", "si es ≥ 5 veces más larga", HEX.B);
stat(s, 9.2, 4.85, 3.5, "|ρ| ≤ 0.24", "correlación máxima de una variable con el voto");
caption(s, "Señales reales pero débiles: esperábamos superar al azar por un margen modesto.", 0.6, 5.0, 8.2);

// ---------- 7. Metodología ----------
s = slide("4 · Metodología", "De los datos a la aplicación en seis pasos", "Metodología");
const pasos = [["EDA", "sesgos y variables"], ["Variables", "18 + TF-IDF"], ["Partición", "80/20 estratificada"],
  ["Entrenar", "4 modelos + base"], ["Ajustar", "CV 3 pliegues, log loss"], ["App", "Streamlit + Plotly"]];
pasos.forEach(([h, t], i) => {
  const x = 0.6 + i * 2.05;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.1, w: 1.8, h: 1.6, rectRadius: 0.1, objectName: "paso " + h,
    fill: { color: i === 5 ? C.accent6 : C.text2 }, line: { type: "none" } });
  s.addText([{ text: String(i + 1), options: { fontSize: 14, color: "CADCFC", breakLine: true } },
    { text: h, options: { fontSize: 20, bold: true, color: "FFFFFF" } }],
    { x, y: 2.2, w: 1.8, h: 1.0, align: "center", isTextBox: true, margin: 0 });
  s.addText(t, { x: x + 0.1, y: 3.15, w: 1.6, h: 0.5, fontSize: 12, color: "E6ECF5", align: "center", isTextBox: true, margin: 0 });
  if (i < 5) s.addText("›", { x: x + 1.8, y: 2.55, w: 0.25, h: 0.6, fontSize: 28, color: HEX.muted, align: "center", isTextBox: true, margin: 0 });
});
bullets(s, [
  "El conjunto de prueba no se tocó hasta el final: ajuste y calibración con validación cruzada dentro del entrenamiento",
  "Semilla fija (42): la app reproduce la misma partición y sus predicciones coinciden con el cuaderno",
  "Todo en CPU en laptops personales: Python, pandas, scikit-learn, matplotlib, Streamlit, Plotly",
], { x: 0.6, y: 4.25, w: 12.1, h: 2.3 });

// ---------- 8. Modelos y ajuste ----------
s = slide("4 · Modelos", "Tres algoritmos, del más simple al más rico", "Metodología");
const rows = [
  [{ text: "Modelo", options: { bold: true, color: "FFFFFF", fill: { color: HEX.navy } } },
   { text: "Entrada", options: { bold: true, color: "FFFFFF", fill: { color: HEX.navy } } },
   { text: "Ajuste de parámetros", options: { bold: true, color: "FFFFFF", fill: { color: HEX.navy } } }],
  [{ text: "Línea base (a priori)", options: { color: "6F757B" } }, "Ninguna", "Predice la proporción de clases del entrenamiento"],
  [{ text: "LogReg estructural", options: { bold: true, color: HEX.lr } }, "18 variables estandarizadas", "L2, C = 1.0"],
  [{ text: "LogReg TF-IDF + estructura", options: { bold: true, color: HEX.tfidf } }, "TF-IDF de A y B + 18 variables", "C = 0.3 (más regularización) + calibración sigmoide (Platt, cv = 3)"],
  [{ text: "HistGradientBoosting", options: { bold: true, color: HEX.hgb } }, "18 variables", "GridSearchCV de 12 combinaciones → lr = 0.05, 300 iter., L2 = 1.0; parada temprana en 43"],
];
s.addTable(rows, { x: 0.6, y: 1.8, w: 12.1, colW: [3.4, 3.4, 5.3], fontSize: 15, color: "1F2933",
  border: { type: "solid", pt: 0.75, color: "DDE3EA" }, fill: { color: "FFFFFF" }, rowH: 0.62, valign: "middle", objectName: "tabla de modelos" });
card(s, 0.6, 5.35, 12.1, 1.15, "aprendizaje clave");
s.addText([{ text: "Lección clave: ", options: { bold: true, color: HEX.tfidf } },
  { text: "sin calibrar, el modelo TF-IDF era sobreconfiado y su log loss era peor que la del azar pese a buena exactitud. La calibración lo convirtió en el mejor." }],
  { x: 0.9, y: 5.45, w: 11.5, h: 0.95, fontSize: 15, color: C.text1, valign: "middle", isTextBox: true });

// ---------- 9. Resultados: log loss ----------
s = slide("5 · Resultados", "Todos superan al azar; el TF-IDF calibrado gana", "Resultados");
const nombres = ["Línea base", "LogReg estructural", "HistGB sin ajustar", "HistGB ajustado", "LogReg TF-IDF"];
s.addChart(pres.charts.BAR, [{ name: "Log loss", labels: nombres, values: [1.0972, 1.0654, 1.0470, 1.0460, 1.0414] }], Object.assign({
  x: 0.6, y: 1.7, w: 7.6, h: 4.9, barDir: "bar", chartColors: [HEX.base, HEX.lr, HEX.hgb0, HEX.hgb, HEX.tfidf],
  showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0000", valAxisMinVal: 1.0, valAxisMaxVal: 1.11,
  valAxisMajorUnit: 0.02, valAxisLabelFormatCode: "0.00", showLegend: false, showTitle: true,
  title: "Log loss en prueba (menor es mejor)", objectName: "grafica log loss" }, axis));
stat(s, 8.6, 1.75, 4.1, "1.0414", "log loss del mejor modelo (azar: 1.099)", HEX.tfidf);
stat(s, 8.6, 3.3, 4.1, "47.3%", "exactitud (línea base: 34.9%)", HEX.tfidf);
stat(s, 8.6, 4.85, 4.1, "−5.1%", "log loss frente a la línea base");

// ---------- 10. Costo ----------
s = slide("5 · Resultados", "HistGB logra casi lo mismo, 13 veces más rápido", "Resultados");
const n3 = ["LogReg estructural", "HistGB ajustado", "LogReg TF-IDF"];
s.addChart(pres.charts.BAR, [
  { name: "Exactitud", labels: n3, values: [0.434, 0.457, 0.473] },
  { name: "F1 macro", labels: n3, values: [0.365, 0.451, 0.455] },
], Object.assign({ x: 0.6, y: 1.7, w: 6.3, h: 4.9, barDir: "col", barGrouping: "clustered",
  chartColors: [HEX.navy, HEX.gold], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
  valAxisMinVal: 0, valAxisMaxVal: 0.55, valAxisLabelFormatCode: "0.0", showLegend: true, legendPos: "b",
  showTitle: true, title: "Exactitud y F1 macro", objectName: "grafica exactitud f1" }, axis));
s.addChart(pres.charts.BAR, [{ name: "Segundos", labels: n3, values: [0.1, 6.2, 83.5] }], Object.assign({
  x: 7.1, y: 1.7, w: 5.6, h: 4.9, barDir: "col", chartColors: [HEX.lr, HEX.hgb, HEX.tfidf],
  showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0 \"s\"", valAxisLabelFormatCode: "0",
  showLegend: false, showTitle: true, title: "Tiempo de entrenamiento (s)", objectName: "grafica tiempo" }, axis));

// ---------- 11. Empate ----------
s = slide("5 · Errores", "El empate es la clase más difícil", "Resultados");
s.addImage({ path: IMG("notebooks/resultados_modelado/matrices_confusion_modelos.png"), x: 0.6, y: 1.7, w: 8.4, h: 2.59, objectName: "matrices de confusion" });
s.addChart(pres.charts.BAR, [{ name: "Recall empate", labels: n3, values: [0.05, 0.34, 0.25] }], Object.assign({
  x: 9.2, y: 1.6, w: 3.5, h: 3.2, barDir: "col", chartColors: [HEX.lr, HEX.hgb, HEX.tfidf], showValue: true,
  dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 0.4, valAxisLabelFormatCode: "0.0",
  catAxisLabelFontSize: 10, showLegend: false, showTitle: true, title: "Exhaustividad del empate", objectName: "grafica recall empate" }, axis));
bullets(s, [
  "A y B se reconocen en 50–61% de los casos; el empate se confunde con una victoria",
  "HistGB detecta más empates (0.34): modela combinaciones como “longitudes parecidas y poco formato”",
  "La LogReg estructural casi nunca predice empate (0.05), de ahí su F1 macro bajo",
], { x: 0.6, y: 4.75, w: 12.1, h: 1.9 });

// ---------- 12. Sesgo heredado ----------
s = slide("5 · Análisis", "Los modelos heredan el sesgo de verbosidad", "Resultados");
const grupos = ["B mucho más larga", "B más larga", "Similares", "A más larga", "A mucho más larga"];
s.addChart(pres.charts.LINE, [
  { name: "LogReg TF-IDF", labels: grupos, values: [0.544, 0.463, 0.420, 0.500, 0.536] },
  { name: "HistGB ajustado", labels: grupos, values: [0.513, 0.469, 0.408, 0.473, 0.501] },
  { name: "LogReg estructural", labels: grupos, values: [0.515, 0.440, 0.365, 0.468, 0.495] },
  { name: "Línea base", labels: grupos, values: [0.240, 0.250, 0.331, 0.469, 0.494] },
], Object.assign({ x: 0.6, y: 1.7, w: 8.2, h: 4.9, chartColors: [HEX.tfidf, HEX.hgb, HEX.lr, HEX.base],
  lineSize: 2.5, lineDataSymbolSize: 8, valAxisMinVal: 0.2, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0%",
  showLegend: true, legendPos: "b", showTitle: true, title: "Exactitud según la longitud relativa de A y B",
  objectName: "grafica sesgo heredado" }, axis));
stat(s, 9.2, 1.75, 3.5, "54%", "exactitud si una respuesta es mucho más larga", HEX.tfidf);
stat(s, 9.2, 3.3, 3.5, "42%", "exactitud si tienen longitud similar", HEX.tfidf);
s.addText("Los modelos aprendieron sobre todo cuál respuesta es más larga, no cuál es mejor: len_diff y len_ratio son sus variables de mayor peso.",
  { x: 9.2, y: 4.85, w: 3.5, h: 1.75, fontSize: 14, color: C.text1, valign: "top", isTextBox: true, margin: 0 });

// ---------- 13. App: predicción ----------
s = slide("6 · La aplicación", "Predecir una batalla nueva con uno o todos los modelos", "Aplicación");
s.addImage({ path: IMG("entregables/capturas_app/app_3_predecir.png"), x: 0.6, y: 1.65, w: 5.39, h: 5.5, objectName: "captura prediccion" });
bullets(s, [
  "El usuario escribe un prompt y dos respuestas o carga una batalla real",
  "El preprocesamiento es invisible: las 18 variables se calculan solas",
  "Cada modelo muestra su predicción, confianza y log loss de prueba, más el consenso",
  "En ejemplos reales indica el voto humano y qué modelos acertaron",
  "Colores: A azul y B naranja (complementarios), empate gris neutro",
], { x: 6.4, y: 1.8, w: 6.3, h: 4.8 });

// ---------- 14. App: historia y rendimiento ----------
s = slide("6 · La aplicación", "Explorar los datos y el rendimiento, interactivo", "Aplicación");
s.addImage({ path: IMG("entregables/capturas_app/app_1_historia.png"), x: 0.6, y: 1.65, w: 3.75, h: 5.47, objectName: "captura historia" });
s.addImage({ path: IMG("entregables/presentacion/rendimiento_recorte.png"), x: 4.55, y: 1.65, w: 3.75, h: 5.47, objectName: "captura rendimiento" });
bullets(s, [
  "La historia: los sesgos del EDA y qué aprendió cada modelo",
  "Explorar datos: cualquier variable por resultado, dispersión y correlaciones",
  "Rendimiento: métricas, matriz de confusión, calibración y sesgo de longitud",
  "Un interruptor oculta el rendimiento",
  "Streamlit + Plotly: reutiliza en Python los modelos de scikit-learn",
], { x: 8.6, y: 1.8, w: 4.1, h: 4.9, fontSize: 15 });

// ---------- 15. Conclusiones ----------
s = slide("7 · Conclusiones", "Lo que logramos y lo que sigue", "Cierre");
const concl = [
  ["Objetivos cumplidos", "Literatura → 3 algoritmos; 18 variables; 4 modelos ajustados y comparados; app completa.", HEX.navy],
  ["Mejora real, pero modesta", "TF-IDF calibrado: log loss 1.0414 y 47.3% de exactitud, frente a 1.0972 y 34.9% del azar.", HEX.tfidf],
  ["El sesgo manda", "Los modelos aciertan 54% cuando una respuesta es mucho más larga y 42% cuando son similares.", HEX.B],
  ["Siguiente paso", "Ajustar un transformer sobre (prompt, A, B), promediar con A/B intercambiadas y validar por prompt.", HEX.hgb],
];
concl.forEach(([h, t, col], i) => {
  const x = 0.6 + (i % 2) * 6.15, y = 1.75 + Math.floor(i / 2) * 2.45;
  card(s, x, y, 5.95, 2.2, "conclusion " + h);
  s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.5, h: 0.5, fill: { color: col }, line: { type: "none" }, objectName: "icono " + h });
  s.addText("✓", { x: x + 0.3, y: y + 0.3, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(h, { x: x + 1.0, y: y + 0.3, w: 4.7, h: 0.5, fontSize: 20, bold: true, color: C.text2, valign: "middle", isTextBox: true, margin: 0 });
  s.addText(t, { x: x + 0.3, y: y + 0.95, w: 5.35, h: 1.1, fontSize: 15, color: C.text1, valign: "top", isTextBox: true, margin: 0 });
});

// ---------- 16. Cierre ----------
pres.addSection({ title: "Referencias" });
s = pres.addSlide({ masterName: "PORTADA", sectionTitle: "Referencias" });
s.addText("Gracias — ¿preguntas?", { placeholder: "title" });
s.addText("github.com/jlope384/Proyecto2-Data-Science  ·  app: streamlit run app/app.py", { placeholder: "body" });
s.addText([
  { text: "Referencias principales", options: { bold: true, color: "FFFFFF", breakLine: true } },
  { text: "Chiang et al. (2024), ICML · Zheng et al. (2023), NeurIPS · Ouyang et al. (2022), NeurIPS · Wang et al. (2024), ACL", options: { breakLine: true } },
  { text: "Friedman (2001), Ann. Stat. · Ke et al. (2017), NeurIPS · Salton & Buckley (1988), IP&M · Platt (1999) · Pedregosa et al. (2011), JMLR", options: { breakLine: true } },
  { text: "Lista completa en APA en el informe final.", options: { italic: true } },
], { x: 1.2, y: 5.0, w: 10.9, h: 1.6, fontSize: 13, color: "CADCFC", align: "center", isTextBox: true });

(async () => {
  await pres.writeFile({ fileName: OUT });
  if (APPLY_THEME) { const { applyTheme } = require(APPLY_THEME); await applyTheme(OUT, THEME); }
  console.log("Escrito", OUT);
})();
