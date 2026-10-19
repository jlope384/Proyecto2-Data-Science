"""Registro de los modelos entrenados en `notebooks/Modelado_ChatbotArena.ipynb`."""
from pathlib import Path

import joblib

from preprocesamiento import CLASSES, NUM_FEATURES, TEXT_COLS, proba_ordenada

RAIZ = Path(__file__).resolve().parent.parent
DIR_MODELOS = RAIZ / 'notebooks' / 'resultados_modelado'
DIR_DATOS = Path(__file__).resolve().parent / 'datos'

# nombre (igual que en comparacion_modelos.csv) -> archivo, columnas de entrada, descripción
MODELOS = {
    'LogReg TF-IDF + estructura': dict(
        archivo='modelo_logreg_tfidf.joblib',
        columnas=TEXT_COLS + NUM_FEATURES,
        corto='TF-IDF',
        descripcion='Regresión logística sobre el texto de A y B (TF-IDF de 1–2 gramas) '
                    'más las variables estructurales, con probabilidades calibradas.'),
    'HistGB (ajustado)': dict(
        archivo='modelo_histgb_ajustado.joblib',
        columnas=NUM_FEATURES,
        corto='HistGB',
        descripcion='Gradient boosting de histogramas sobre las variables estructurales, '
                    'hiperparámetros elegidos con GridSearchCV.'),
    'LogReg estructural': dict(
        archivo='modelo_logreg_estructural.joblib',
        columnas=NUM_FEATURES,
        corto='LogReg',
        descripcion='Regresión logística sobre longitud, formato y turnos. '
                    'La más simple e interpretable.'),
}
BASELINE = 'Línea base (prior)'


def cargar_modelos():
    return {nombre: joblib.load(DIR_MODELOS / cfg['archivo']) for nombre, cfg in MODELOS.items()}


def predecir(modelos, nombre, X):
    return proba_ordenada(modelos[nombre], X[MODELOS[nombre]['columnas']])


__all__ = ['MODELOS', 'BASELINE', 'CLASSES', 'DIR_MODELOS', 'DIR_DATOS', 'cargar_modelos', 'predecir']
