"""Preprocesamiento compartido entre el cuaderno de modelado y la aplicación.

Replica exactamente la lógica de `notebooks/Modelado_ChatbotArena.ipynb` (secciones 2 y 2.1)
para que una entrada nueva (prompt + respuesta A + respuesta B) produzca las mismas
variables con las que se entrenaron los modelos.
"""
import json
import re

import numpy as np
import pandas as pd

CLASSES = ['A', 'B', 'tie']

NUM_FEATURES = ['n_turns', 'prompt_len', 'prompt_words',
                'len_a', 'len_b', 'words_a', 'words_b', 'fmt_a', 'fmt_b',
                'len_diff', 'len_ratio', 'words_diff', 'fmt_diff',
                'code_diff', 'lists_diff', 'headers_diff', 'bold_diff', 'a_is_longer']
TEXT_COLS = ['response_a_text', 'response_b_text']

# Descripción legible de cada variable (para la exploración en la app)
DESCRIPCIONES = {
    'n_turns': 'Número de turnos de la conversación',
    'prompt_len': 'Caracteres del prompt',
    'prompt_words': 'Palabras del prompt',
    'len_a': 'Caracteres de la respuesta A',
    'len_b': 'Caracteres de la respuesta B',
    'words_a': 'Palabras de la respuesta A',
    'words_b': 'Palabras de la respuesta B',
    'fmt_a': 'Elementos de formato en A (código, listas, encabezados, negritas)',
    'fmt_b': 'Elementos de formato en B',
    'len_diff': 'Caracteres de A − caracteres de B',
    'len_ratio': 'log((len A + 1) / (len B + 1)); > 0 si A es más larga',
    'words_diff': 'Palabras de A − palabras de B',
    'fmt_diff': 'Formato de A − formato de B',
    'code_diff': 'Bloques de código de A − de B',
    'lists_diff': 'Viñetas de A − de B',
    'headers_diff': 'Encabezados markdown de A − de B',
    'bold_diff': 'Negritas de A − de B',
    'a_is_longer': '1 si A es más larga que B',
}

re_code = re.compile(r'```')
re_list = re.compile(r'^\s*(?:[-*•]|\d+[.)])\s+', re.M)
re_header = re.compile(r'^\s*#{1,6}\s+', re.M)
re_bold = re.compile(r'\*\*[^*]+\*\*')


def decode(s):
    """Las columnas del CSV son listas JSON (una entrada por turno)."""
    try:
        lst = json.loads(s)
    except Exception:
        return [str(s)]
    return [('' if x is None else str(x)) for x in lst]


def text_feats(t):
    return dict(len=len(t), words=len(t.split()),
                code=len(re_code.findall(t)) // 2, lists=len(re_list.findall(t)),
                headers=len(re_header.findall(t)), bold=len(re_bold.findall(t)))


def construir_variables(df):
    """Recibe un DataFrame con prompt_text, response_a_text, response_b_text y n_turns
    y agrega todas las variables estructurales y comparativas."""
    df = df.copy()
    for side in ['a', 'b']:
        f = pd.DataFrame(df[f'response_{side}_text'].map(text_feats).tolist(), index=df.index)
        for col in f.columns:
            df[f'{col}_{side}'] = f[col].values

    df['prompt_len'] = df['prompt_text'].str.len()
    df['prompt_words'] = df['prompt_text'].str.split().str.len()
    df['fmt_a'] = df[['code_a', 'lists_a', 'headers_a', 'bold_a']].sum(axis=1)
    df['fmt_b'] = df[['code_b', 'lists_b', 'headers_b', 'bold_b']].sum(axis=1)

    eps = 1.0
    df['len_diff'] = df['len_a'] - df['len_b']
    df['len_ratio'] = np.log((df['len_a'] + eps) / (df['len_b'] + eps))
    df['words_diff'] = df['words_a'] - df['words_b']
    df['fmt_diff'] = df['fmt_a'] - df['fmt_b']
    df['code_diff'] = df['code_a'] - df['code_b']
    df['lists_diff'] = df['lists_a'] - df['lists_b']
    df['headers_diff'] = df['headers_a'] - df['headers_b']
    df['bold_diff'] = df['bold_a'] - df['bold_b']
    df['a_is_longer'] = (df['len_a'] > df['len_b']).astype(int)
    return df


def limpiar_crudo(raw):
    """Limpieza del CSV original de Kaggle (igual que el cuaderno)."""
    df = raw.copy()
    df = df.drop_duplicates(subset=df.columns.difference(['id']).tolist()).reset_index(drop=True)
    df['winner'] = np.select([df.winner_model_a == 1, df.winner_model_b == 1], ['A', 'B'], default='tie')
    for c in ['prompt', 'response_a', 'response_b']:
        df[c + '_text'] = df[c].map(decode).map(lambda l: '\n'.join(l))
    df['n_turns'] = df['prompt'].map(decode).map(len)
    return construir_variables(df)


def entrada_a_variables(prompt, respuesta_a, respuesta_b, n_turns=1):
    """Convierte una entrada nueva escrita por el usuario en la fila que esperan los modelos."""
    df = pd.DataFrame([{
        'prompt_text': prompt or '',
        'response_a_text': respuesta_a or '',
        'response_b_text': respuesta_b or '',
        'n_turns': int(max(1, n_turns)),
    }])
    return construir_variables(df)


def proba_ordenada(modelo, X):
    """predict_proba reordenado a CLASSES, sin importar el orden interno del modelo."""
    p = modelo.predict_proba(X)
    cols = list(modelo.classes_)
    return p[:, [cols.index(c) for c in CLASSES]]
