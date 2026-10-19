// Regresión logística "estructural" entrenada en notebooks/Modelado_ChatbotArena.ipynb
// (StandardScaler + LogisticRegression multinomial sobre 18 variables derivadas).
// Los parámetros se exportaron del .joblib, así que la predicción es la misma
// que en Python. Log loss en prueba: 1.065 (línea base: 1.097).
export const MODEL = {
  "features": [
    "n_turns",
    "prompt_len",
    "prompt_words",
    "len_a",
    "len_b",
    "words_a",
    "words_b",
    "fmt_a",
    "fmt_b",
    "len_diff",
    "len_ratio",
    "words_diff",
    "fmt_diff",
    "code_diff",
    "lists_diff",
    "headers_diff",
    "bold_diff",
    "a_is_longer"
  ],
  "classes": [
    "A",
    "B",
    "tie"
  ],
  "mean": [
    1.2429311,
    349.35423,
    55.77584,
    1330.3925,
    1337.2224,
    212.35519,
    213.13348,
    4.4675483,
    4.4859057,
    -6.8298678,
    -0.0028001337,
    -0.77829737,
    -0.018357404,
    0.0057856273,
    -0.0099182182,
    -0.009591961,
    -0.0046328519,
    0.49717244
  ],
  "scale": [
    0.89861104,
    1006.4452,
    149.04944,
    1445.5681,
    1495.9638,
    223.43677,
    230.24374,
    9.2327788,
    9.3021685,
    1049.3286,
    1.0591722,
    164.42416,
    9.1467842,
    1.4279157,
    7.125252,
    1.4423464,
    3.498844,
    0.499992
  ],
  "coef": [
    [
      -0.026266592,
      0.0082450299,
      -0.024778224,
      0.095277726,
      -0.02570238,
      -0.020857719,
      0.018920535,
      0.0092753056,
      -0.0081842133,
      0.16789809,
      0.090651439,
      -0.054838146,
      0.017685754,
      0.012261988,
      0.015267031,
      -0.0092723732,
      0.013962104,
      0.081471341
    ],
    [
      -0.013904857,
      0.025753769,
      -0.046298267,
      -0.033530384,
      0.07548037,
      0.01615197,
      -0.0065964636,
      -0.0072401793,
      0.0044347321,
      -0.15379963,
      -0.10442621,
      0.031186041,
      -0.011818317,
      0.010201249,
      -0.0097377608,
      0.0021885465,
      -0.01613069,
      -0.06063359
    ],
    [
      0.040171448,
      -0.033998799,
      0.071076492,
      -0.061747342,
      -0.04977799,
      0.0047057486,
      -0.012324071,
      -0.0020351263,
      0.0037494812,
      -0.01409846,
      0.013774769,
      0.023652105,
      -0.0058674366,
      -0.022463237,
      -0.0055292698,
      0.0070838267,
      0.0021685854,
      -0.020837751
    ]
  ],
  "intercept": [
    0.035943194,
    0.015923864,
    -0.051867058
  ]
} as const;

export type Winner = "A" | "B" | "tie";

const reCode = /```/g;
const reList = /^\s*(?:[-*\u2022]|\d+[.)])\s+/gm;
const reHeader = /^\s*#{1,6}\s+/gm;
const reBold = /\*\*[^*]+\*\*/g;
const count = (re: RegExp, t: string) => t.match(re)?.length ?? 0;
// len() y split() de Python: cuenta code points y separa por espacios
const pyLen = (t: string) => [...t].length;
const pyWords = (t: string) => t.split(/\s+/).filter(Boolean).length;

function textFeats(t: string) {
  const code = Math.floor(count(reCode, t) / 2);
  const lists = count(reList, t);
  const headers = count(reHeader, t);
  const bold = count(reBold, t);
  return { len: pyLen(t), words: pyWords(t), code, lists, headers, bold, fmt: code + lists + headers + bold };
}

// Mismas variables y en el mismo orden que NUM_FEATURES del cuaderno
export function features(prompt: string, a: string, b: string): Record<string, number> {
  const fa = textFeats(a);
  const fb = textFeats(b);
  return {
    n_turns: 1,
    prompt_len: pyLen(prompt),
    prompt_words: pyWords(prompt),
    len_a: fa.len,
    len_b: fb.len,
    words_a: fa.words,
    words_b: fb.words,
    fmt_a: fa.fmt,
    fmt_b: fb.fmt,
    len_diff: fa.len - fb.len,
    len_ratio: Math.log((fa.len + 1) / (fb.len + 1)),
    words_diff: fa.words - fb.words,
    fmt_diff: fa.fmt - fb.fmt,
    code_diff: fa.code - fb.code,
    lists_diff: fa.lists - fb.lists,
    headers_diff: fa.headers - fb.headers,
    bold_diff: fa.bold - fb.bold,
    a_is_longer: fa.len > fb.len ? 1 : 0,
  };
}

// Escala, combinación lineal por clase y softmax
export function predict(x: Record<string, number>): Record<Winner, number> {
  const z = MODEL.features.map((f, i) => (x[f] - MODEL.mean[i]) / MODEL.scale[i]);
  const logits = MODEL.coef.map((w, k) => MODEL.intercept[k] + w.reduce((s, wi, i) => s + wi * z[i], 0));
  const top = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - top));
  const sum = e.reduce((s, v) => s + v, 0);
  return { A: e[0] / sum, B: e[1] / sum, tie: e[2] / sum };
}
