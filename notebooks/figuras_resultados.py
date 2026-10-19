"""Figuras estáticas de comparación de modelos para el informe final.

Usa las predicciones sobre el conjunto de prueba que genera app/preparar_datos.py
(misma partición que Modelado_ChatbotArena.ipynb). Ejecutar desde la raíz del repo:
    python notebooks/figuras_resultados.py
"""
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, log_loss, precision_recall_fscore_support

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / 'app'))
from modelos import BASELINE, CLASSES, DIR_DATOS, MODELOS  # noqa: E402

SALIDA = RAIZ / 'notebooks' / 'resultados_modelado'
COLOR_MODELO = {'LogReg TF-IDF + estructura': '#6A4C93', 'HistGB (ajustado)': '#1B998B',
                'HistGradientBoosting': '#7FCDC4', 'LogReg estructural': '#4A6FA5', BASELINE: '#BDBDBD'}
NOMBRE_CLASE = {'A': 'Gana A', 'B': 'Gana B', 'tie': 'Empate'}
plt.rcParams.update({'figure.dpi': 110, 'axes.spines.top': False, 'axes.spines.right': False,
                     'axes.grid': True, 'grid.alpha': 0.3, 'font.size': 10})

comp = pd.read_csv(SALIDA / 'comparacion_modelos.csv')
df = pd.read_parquet(DIR_DATOS / 'dataset_limpio.parquet')
pred = pd.read_parquet(DIR_DATOS / 'predicciones_prueba.parquet')
y = pred['real'].values
nombres = list(MODELOS)
P = {n: pred[[f'{n}|{c}' for c in CLASSES]].values for n in [BASELINE] + nombres}

# (5) Efectividad contra costo: log loss, exactitud/F1 y tiempo de entrenamiento
orden = comp.sort_values('log_loss', ascending=False)
colores = [COLOR_MODELO[m] for m in orden['modelo']]
fig, ax = plt.subplots(1, 3, figsize=(15, 4.2))
ax[0].barh(orden['modelo'], orden['log_loss'], color=colores)
ax[0].axvline(np.log(3), ls='--', color='#C44E52')
ax[0].text(np.log(3) - 0.001, len(orden) - 0.45, 'azar: ln(3)', color='#C44E52', ha='right', fontsize=8)
ax[0].set_xlim(1.0, 1.105); ax[0].set_title('Log loss (menor es mejor)')
for i, v in enumerate(orden['log_loss']):
    ax[0].text(min(v, 1.085) + 0.001, i, f'{v:.4f}', va='center', fontsize=8)
x = np.arange(len(orden)); w = 0.38
ax[1].barh(x + w / 2, orden['accuracy'], w, color=colores, label='Exactitud')
ax[1].barh(x - w / 2, orden['f1_macro'], w, color=colores, alpha=0.5, hatch='//', label='F1 macro')
ax[1].set_yticks(x, ['' for _ in x]); ax[1].set_xlim(0, 0.55)
ax[1].set_title('Exactitud (sólido) y F1 macro (rayado)')
ax[2].barh(orden['modelo'], orden['seg_entrenamiento'].clip(lower=0.05), color=colores)
ax[2].set_xscale('log'); ax[2].set_yticks(x, ['' for _ in x])
ax[2].set_title('Tiempo de entrenamiento (s, escala log)')
for i, v in enumerate(orden['seg_entrenamiento']):
    ax[2].text(max(v, 0.05) * 1.15, i, f'{v:.1f} s', va='center', fontsize=8)
fig.suptitle('Comparación de modelos en el conjunto de prueba (n = 11,494)', fontweight='bold')
plt.tight_layout(); plt.savefig(SALIDA / 'comparacion_efectividad_tiempo.png', dpi=150); plt.close()

# (6) Matrices de confusión normalizadas de los tres modelos
fig, ax = plt.subplots(1, 3, figsize=(14, 4.3))
for a, n in zip(ax, nombres):
    cm = confusion_matrix(y, np.array(CLASSES)[P[n].argmax(1)], labels=CLASSES)
    z = cm / cm.sum(1, keepdims=True)
    a.imshow(z, cmap='Purples' if 'TF' in n else 'Greens' if 'HistGB' in n else 'Blues', vmin=0, vmax=0.7)
    for i in range(3):
        for j in range(3):
            a.text(j, i, f'{z[i, j]:.0%}\n({cm[i, j]:,})', ha='center', va='center', fontsize=9,
                   color='white' if z[i, j] > 0.45 else '#222')
    etiquetas = [NOMBRE_CLASE[c] for c in CLASSES]
    a.set_xticks(range(3), etiquetas); a.set_yticks(range(3), etiquetas); a.grid(False)
    a.set_xlabel('Predicción'); a.set_ylabel('Real'); a.set_title(n)
fig.suptitle('Matrices de confusión (porcentaje por fila real)', fontweight='bold')
plt.tight_layout(); plt.savefig(SALIDA / 'matrices_confusion_modelos.png', dpi=150); plt.close()

# (7) Exhaustividad por clase
fig, ax = plt.subplots(figsize=(8, 4))
w = 0.26
for k, n in enumerate(nombres):
    _, rc, _, _ = precision_recall_fscore_support(y, np.array(CLASSES)[P[n].argmax(1)],
                                                  labels=CLASSES, zero_division=0)
    barras = ax.bar(np.arange(3) + (k - 1) * w, rc, w, color=COLOR_MODELO[n], label=n)
    ax.bar_label(barras, fmt='%.2f', fontsize=8)
ax.set_xticks(range(3), [NOMBRE_CLASE[c] for c in CLASSES]); ax.set_ylabel('Exhaustividad (recall)')
ax.set_title('Exhaustividad por clase: el empate es la clase más difícil'); ax.legend(fontsize=8)
plt.tight_layout(); plt.savefig(SALIDA / 'exhaustividad_por_clase.png', dpi=150); plt.close()

# (8) Exactitud según la longitud relativa de las respuestas
bins = [-np.inf, -1.0, -0.3, 0.3, 1.0, np.inf]
etiq = ['B mucho\nmás larga', 'B más\nlarga', 'Similares', 'A más\nlarga', 'A mucho\nmás larga']
grupo = pd.cut(pred[['id']].merge(df[['id', 'len_ratio']], on='id')['len_ratio'], bins, labels=etiq)
fig, ax = plt.subplots(1, 2, figsize=(13, 4.2))
for n in [BASELINE] + nombres:
    acierto = np.array(CLASSES)[P[n].argmax(1)] == y
    acc = [acierto[(grupo == g).values].mean() for g in etiq]
    ll = [log_loss(y[(grupo == g).values], P[n][(grupo == g).values], labels=CLASSES) for g in etiq]
    estilo = dict(color=COLOR_MODELO[n], marker='o', label=n, ls='--' if n == BASELINE else '-')
    ax[0].plot(etiq, acc, **estilo); ax[1].plot(etiq, ll, **estilo)
ax[0].set_title('Exactitud'); ax[0].yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f'{v:.0%}'))
ax[1].set_title('Log loss (menor es mejor)'); ax[1].legend(fontsize=8)
fig.suptitle('Rendimiento según la longitud relativa de las respuestas (len A / len B)', fontweight='bold')
plt.tight_layout(); plt.savefig(SALIDA / 'rendimiento_por_longitud.png', dpi=150); plt.close()

print('Figuras guardadas en', SALIDA)
