"""Genera los artefactos que usa la aplicación a partir del train.csv de Kaggle.

Uso (una sola vez, desde la carpeta app/):
    python preparar_datos.py ruta/a/train.csv

Reproduce la misma limpieza y la misma partición 80/20 del cuaderno de modelado
(RANDOM_STATE = 42), así que el conjunto de prueba es idéntico al de la evaluación.
Salidas en app/datos/:
    dataset_limpio.parquet       variables numéricas + objetivo + modelos + partición
    predicciones_prueba.parquet  probabilidades de cada modelo en el conjunto de prueba
    ejemplos.parquet             batallas reales del conjunto de prueba para probar la app
    prior.json                   distribución de clases del entrenamiento (línea base)
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from modelos import BASELINE, CLASSES, DIR_DATOS, DIR_MODELOS, MODELOS, cargar_modelos, predecir
from preprocesamiento import NUM_FEATURES, limpiar_crudo

RANDOM_STATE = 42


def main(ruta_csv):
    print('Leyendo', ruta_csv)
    df = limpiar_crudo(pd.read_csv(ruta_csv))
    y = df['winner'].to_numpy(dtype=object)
    X_train, X_test, y_train, y_test = train_test_split(
        df, y, test_size=0.20, stratify=y, random_state=RANDOM_STATE)
    print('Entrenamiento:', len(X_train), ' Prueba:', len(X_test))

    DIR_DATOS.mkdir(exist_ok=True)

    # Dataset limpio, sin los textos completos (para la exploración)
    df['particion'] = 'entrenamiento'
    df.loc[X_test.index, 'particion'] = 'prueba'
    cols = ['id', 'model_a', 'model_b', 'winner', 'particion'] + NUM_FEATURES
    df[cols].to_parquet(DIR_DATOS / 'dataset_limpio.parquet', index=False)

    # Línea base: distribución a priori del entrenamiento
    prior = pd.Series(y_train).value_counts(normalize=True).reindex(CLASSES).tolist()
    (DIR_DATOS / 'prior.json').write_text(json.dumps(dict(zip(CLASSES, prior))))

    # Probabilidades de cada modelo sobre el conjunto de prueba
    modelos = cargar_modelos()
    pred = pd.DataFrame({'id': X_test['id'].values, 'real': y_test})
    for i, c in enumerate(CLASSES):
        pred[f'{BASELINE}|{c}'] = prior[i]
    for nombre in MODELOS:
        print('Prediciendo con', nombre)
        p = predecir(modelos, nombre, X_test)
        for i, c in enumerate(CLASSES):
            pred[f'{nombre}|{c}'] = p[:, i]
    pred.to_parquet(DIR_DATOS / 'predicciones_prueba.parquet', index=False)

    # Verificación: el mejor modelo debe coincidir con lo que guardó el cuaderno
    ref = DIR_MODELOS / 'predicciones_prueba.csv'
    if ref.exists():
        ref = pd.read_csv(ref)
    if isinstance(ref, pd.DataFrame) and len(ref) != len(pred):
        print('¡Revisar! El conjunto de prueba no tiene el tamaño del cuaderno '
              f'({len(pred)} vs {len(ref)}). ¿Es el train.csv correcto?')
    elif isinstance(ref, pd.DataFrame):
        nuestro = pred[[f'LogReg TF-IDF + estructura|{c}' for c in CLASSES]].values
        dif = np.abs(nuestro - ref[[f'proba_{c}' for c in CLASSES]].values).max()
        print(f'Diferencia máxima con predicciones del cuaderno: {dif:.2e}',
              '(OK)' if dif < 1e-6 else '(¡revisar! la partición no coincide)')

    # Ejemplos reales de prueba (respuestas no muy largas para que se lean bien)
    corto = X_test[(X_test['len_a'] < 1500) & (X_test['len_b'] < 1500)
                   & (X_test['prompt_len'] < 400) & (X_test['n_turns'] == 1)]
    ejemplos = corto.sample(frac=1, random_state=RANDOM_STATE).groupby('winner').head(15)
    ejemplos[['id', 'model_a', 'model_b', 'winner', 'n_turns',
              'prompt_text', 'response_a_text', 'response_b_text']] \
        .to_parquet(DIR_DATOS / 'ejemplos.parquet', index=False)

    print('Listo. Artefactos en', DIR_DATOS)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
