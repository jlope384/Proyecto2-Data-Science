"""Chatbot Arena — aplicación de resultados del Proyecto 2.

Ejecutar desde la carpeta app/:
    streamlit run app.py
"""
import json

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from sklearn.calibration import calibration_curve
from sklearn.metrics import confusion_matrix, log_loss, precision_recall_fscore_support

from modelos import BASELINE, CLASSES, DIR_DATOS, DIR_MODELOS, MODELOS, cargar_modelos, predecir
from preprocesamiento import DESCRIPCIONES, NUM_FEATURES, entrada_a_variables

st.set_page_config(page_title='Chatbot Arena — ¿Quién gana?', page_icon='⚔️', layout='wide')

# ---------------------------------------------------------------------------
# Paleta (teoría del color)
# A y B son rivales -> par complementario azul / naranja, fácil de distinguir
# también con daltonismo. El empate es un gris neutro: no compite con ninguno.
# Los modelos usan una tríada fría (violeta, verde azulado, azul pizarra) para
# no confundirse con los colores de A y B. La línea base es gris claro.
# ---------------------------------------------------------------------------
COLOR_CLASE = {'A': '#2E6FBA', 'B': '#E8833A', 'tie': '#9AA0A6'}
NOMBRE_CLASE = {'A': 'Gana A', 'B': 'Gana B', 'tie': 'Empate'}
COLOR_MODELO = {
    'LogReg TF-IDF + estructura': '#6A4C93',
    'HistGB (ajustado)': '#1B998B',
    'HistGradientBoosting': '#7FCDC4',
    'LogReg estructural': '#4A6FA5',
    BASELINE: '#C4C4C4',
}
ORDEN_CLASES = dict(winner=CLASSES)
LABELS_CLASES = {c: NOMBRE_CLASE[c] for c in CLASSES}
PLANTILLA = 'plotly_white'


def estilo(fig, alto=380):
    fig.update_layout(template=PLANTILLA, height=alto, margin=dict(l=10, r=10, t=50, b=10),
                      legend_title_text='', font=dict(size=13))
    return fig


def nombrar_clases(fig):
    fig.for_each_trace(lambda t: t.update(name=NOMBRE_CLASE.get(t.name, t.name)))
    return fig


# ---------------------------------------------------------------------------
# Carga de artefactos
# ---------------------------------------------------------------------------
@st.cache_resource(show_spinner='Cargando modelos…')
def get_modelos():
    return cargar_modelos()


@st.cache_data
def get_comparacion():
    return pd.read_csv(DIR_MODELOS / 'comparacion_modelos.csv')


@st.cache_data
def get_datos():
    """Devuelve (dataset, predicciones, ejemplos, prior) o None si no se ha corrido preparar_datos.py."""
    archivos = ['dataset_limpio.parquet', 'predicciones_prueba.parquet', 'ejemplos.parquet', 'prior.json']
    if not all((DIR_DATOS / a).exists() for a in archivos):
        return None
    return (pd.read_parquet(DIR_DATOS / 'dataset_limpio.parquet'),
            pd.read_parquet(DIR_DATOS / 'predicciones_prueba.parquet'),
            pd.read_parquet(DIR_DATOS / 'ejemplos.parquet'),
            json.loads((DIR_DATOS / 'prior.json').read_text()))


modelos = get_modelos()
comparacion = get_comparacion()
datos = get_datos()

AVISO_DATOS = ('Faltan los datos procesados. Descarga `train.csv` de la competencia de Kaggle '
               '*LMSYS – Chatbot Arena Human Preference Predictions* y ejecuta '
               '`python preparar_datos.py ruta/a/train.csv` desde la carpeta `app/`.')

# ---------------------------------------------------------------------------
# Barra lateral
# ---------------------------------------------------------------------------
with st.sidebar:
    st.title('⚔️ Chatbot Arena')
    st.caption('Proyecto 2 · CC3084 Data Science · UVG · Grupo 5')
    st.markdown('¿Qué respuesta preferirá una persona? Tres modelos entrenados con '
                '~46 mil batallas reales intentan adivinarlo.')

    st.subheader('Modelos')
    usar_todos = st.toggle('Usar todos los modelos', value=True)
    if usar_todos:
        seleccion = list(MODELOS)
    else:
        seleccion = st.multiselect('Elige los modelos', list(MODELOS), default=[list(MODELOS)[0]])
    for nombre in seleccion:
        st.markdown(f"<span style='color:{COLOR_MODELO[nombre]}'>■</span> **{nombre}**  \n"
                    f"<small>{MODELOS[nombre]['descripcion']}</small>", unsafe_allow_html=True)

    st.subheader('Vista')
    mostrar_rendimiento = st.toggle('Mostrar rendimiento de los modelos', value=True,
                                    help='Oculta o muestra las métricas y gráficas de evaluación.')

    with st.expander('🎨 Sobre los colores'):
        st.markdown(
            f"- <span style='color:{COLOR_CLASE['A']}'>■ **A**</span> y "
            f"<span style='color:{COLOR_CLASE['B']}'>■ **B**</span> son **complementarios** "
            "(azul/naranja): rivales visualmente opuestos y distinguibles con daltonismo.\n"
            f"- <span style='color:{COLOR_CLASE['tie']}'>■ **Empate**</span> es un gris neutro.\n"
            "- Los modelos usan tonos **fríos análogos** (violeta, verde azulado, azul pizarra) "
            "para no confundirse con A y B.",
            unsafe_allow_html=True)

if not seleccion:
    st.warning('Selecciona al menos un modelo en la barra lateral.')
    st.stop()

tab_historia, tab_explorar, tab_predecir, tab_rendimiento = st.tabs(
    ['📖 La historia', '🔎 Explorar datos', '🤖 Predecir', '📊 Rendimiento'])

# ---------------------------------------------------------------------------
# 1. La historia: hallazgos del EDA y cómo se reflejan en los modelos
# ---------------------------------------------------------------------------
BINS_LEN = [-np.inf, -1.0, -0.3, 0.3, 1.0, np.inf]
ETIQ_LEN = ['B mucho más larga', 'B más larga', 'Similares', 'A más larga', 'A mucho más larga']
BINS_FMT = [-np.inf, -3, -1, 0, 2, np.inf]
ETIQ_FMT = ['B con mucho más formato', 'B con más formato', 'Igual formato',
            'A con más formato', 'A con mucho más formato']


def reparto_por_grupo(df, grupo):
    t = pd.crosstab(df[grupo], df['winner'], normalize='index').reindex(columns=CLASSES) * 100
    t = t.reset_index().melt(id_vars=grupo, var_name='winner', value_name='pct')
    n = df[grupo].value_counts()
    t['n'] = t[grupo].map(n)
    return t


def barras_apiladas(t, grupo, titulo):
    fig = px.bar(t, x=grupo, y='pct', color='winner', color_discrete_map=COLOR_CLASE,
                 category_orders=ORDEN_CLASES, custom_data=['n'], title=titulo,
                 labels={grupo: '', 'pct': '% de batallas'})
    fig.update_traces(hovertemplate='%{x}<br>%{y:.1f}% de %{customdata[0]:,} batallas')
    fig.update_layout(barmode='stack', yaxis_range=[0, 100])
    return estilo(nombrar_clases(fig))


with tab_historia:
    st.header('La respuesta más larga suele ganar')
    if datos is None:
        st.info(AVISO_DATOS)
    else:
        df, pred_test, ejemplos, prior = datos
        pct = df['winner'].value_counts(normalize=True) * 100
        c = st.columns(5)
        c[0].metric('Batallas (limpias)', f'{len(df):,}')
        c[1].metric('Chatbots distintos', pd.concat([df.model_a, df.model_b]).nunique())
        c[2].metric('Gana A', f"{pct['A']:.1f}%")
        c[3].metric('Gana B', f"{pct['B']:.1f}%")
        c[4].metric('Empate', f"{pct['tie']:.1f}%")
        st.markdown(
            'Las tres clases están **casi balanceadas**, así que adivinar al azar da una log loss '
            'de ln(3) ≈ 1.099. Cualquier modelo útil debe bajar de ahí. Pero el voto humano '
            'no es ciego: el análisis exploratorio encontró sesgos claros.')

        d = df.assign(grupo_len=pd.cut(df['len_ratio'], BINS_LEN, labels=ETIQ_LEN),
                      grupo_fmt=pd.cut(df['fmt_diff'], BINS_FMT, labels=ETIQ_FMT))
        col1, col2 = st.columns(2)
        with col1:
            t = reparto_por_grupo(d, 'grupo_len')
            st.plotly_chart(barras_apiladas(t, 'grupo_len', '① Sesgo de verbosidad'))
            a_mucho = t[(t.grupo_len == 'A mucho más larga') & (t.winner == 'A')]['pct'].iloc[0]
            st.markdown(f'Cuando **A es mucho más larga** que B (≈2.7× o más), A gana el '
                        f'**{a_mucho:.0f}%** de las veces, contra {pct["A"]:.0f}% en general. '
                        'Lo mismo pasa al revés con B.')
        with col2:
            t = reparto_por_grupo(d, 'grupo_fmt')
            st.plotly_chart(barras_apiladas(t, 'grupo_fmt', '② Sesgo de formato'))
            st.markdown('Listas, encabezados, negritas y bloques de código también inclinan el voto: '
                        'la respuesta “más presentable” tiene ventaja, aunque menor que la longitud.')

        col1, col2 = st.columns(2)
        with col1:
            d['turnos'] = d['n_turns'].clip(upper=4).map(lambda n: '4+' if n == 4 else str(n))
            t = reparto_por_grupo(d, 'turnos')
            fig = barras_apiladas(t, 'turnos', '③ Empates según número de turnos')
            fig.update_xaxes(title='Turnos de la conversación', categoryorder='array',
                             categoryarray=['1', '2', '3', '4+'])
            st.plotly_chart(fig)
            st.markdown('El empate es la clase más difícil: no depende de una sola señal y los modelos '
                        'lo reconocen mucho peor que a A o B (ver la matriz de confusión).')
        with col2:
            largo = pd.concat([
                pd.DataFrame({'modelo': df.model_a, 'gana': df.winner == 'A'}),
                pd.DataFrame({'modelo': df.model_b, 'gana': df.winner == 'B'})])
            wr = largo.groupby('modelo')['gana'].agg(['mean', 'size'])
            wr = wr[wr['size'] >= 300].sort_values('mean')
            wr = pd.concat([wr.head(8), wr.tail(8)]).reset_index()
            fig = px.bar(wr, x='mean', y='modelo', orientation='h', title='④ Quién responde importa',
                         labels={'mean': 'Tasa de victoria', 'modelo': ''}, custom_data=['size'],
                         color='mean', color_continuous_scale=['#E8833A', '#F2F2F2', '#2E6FBA'])
            fig.update_traces(hovertemplate='%{y}<br>Gana %{x:.1%} de %{customdata[0]:,} batallas')
            fig.update_layout(coloraxis_showscale=False, xaxis_tickformat='.0%')
            st.plotly_chart(estilo(fig, 420))
            st.markdown('Los 8 peores y 8 mejores chatbots (≥300 batallas). La identidad del chatbot '
                        'explica mucho, pero **no está disponible** al predecir, así que los modelos '
                        'solo pueden usar el texto y su estructura.')

        st.subheader('¿Qué aprendieron los modelos?')
        lr = modelos['LogReg estructural'].named_steps['clf']
        coefs = pd.DataFrame(lr.coef_, index=lr.classes_, columns=NUM_FEATURES).T
        coefs['importancia'] = coefs.abs().mean(axis=1)
        coefs = coefs.sort_values('importancia').reset_index(names='variable')
        largo = coefs.melt(id_vars='variable', value_vars=CLASSES, var_name='winner', value_name='coef')
        fig = px.bar(largo, x='coef', y='variable', color='winner', barmode='group', orientation='h',
                     color_discrete_map=COLOR_CLASE, category_orders=ORDEN_CLASES,
                     title='Coeficientes de la regresión logística estructural (variables estandarizadas)',
                     labels={'coef': 'Coeficiente (positivo = empuja hacia esa clase)', 'variable': ''})
        st.plotly_chart(estilo(nombrar_clases(fig), 620))
        st.markdown('Las variables comparativas de longitud (`len_ratio`, `len_diff`, `a_is_longer`) '
                    'reciben los pesos más grandes y con signos opuestos para A y B: el modelo '
                    'aprendió el **mismo sesgo de verbosidad** que vimos en el EDA. Por eso el '
                    'mejor modelo mejora sobre la línea base, pero de forma modesta: la longitud '
                    'es una pista útil, no una explicación completa del gusto humano.')

# ---------------------------------------------------------------------------
# 2. Exploración de variables
# ---------------------------------------------------------------------------
with tab_explorar:
    st.header('Explora las variables del modelo')
    if datos is None:
        st.info(AVISO_DATOS)
    else:
        df = datos[0]
        f1, f2, f3 = st.columns([1, 1, 1])
        particion = f1.segmented_control('Partición', ['todas', 'entrenamiento', 'prueba'],
                                         default='todas')
        clases = f2.multiselect('Resultado', CLASSES, default=CLASSES,
                                format_func=NOMBRE_CLASE.get)
        recortar = f3.toggle('Recortar valores extremos (1%–99%)', value=True)

        sub = df[df['winner'].isin(clases)]
        if particion and particion != 'todas':
            sub = sub[sub['particion'] == particion]
        st.caption(f'{len(sub):,} batallas seleccionadas')

        if sub.empty:
            st.warning('No hay batallas con esos filtros.')
        else:
            var = st.selectbox('Variable', NUM_FEATURES, index=NUM_FEATURES.index('len_ratio'),
                               format_func=lambda v: f'{v} — {DESCRIPCIONES[v]}')
            serie = sub[var]
            if recortar:
                lo, hi = serie.quantile([0.01, 0.99])
                sub_v = sub[serie.between(lo, hi)]
            else:
                sub_v = sub
            col1, col2 = st.columns([3, 2])
            with col1:
                fig = px.histogram(sub_v, x=var, color='winner', nbins=60, barmode='overlay',
                                   opacity=0.6, histnorm='percent', color_discrete_map=COLOR_CLASE,
                                   category_orders=ORDEN_CLASES, title=f'Distribución de {var} por resultado',
                                   labels={var: DESCRIPCIONES[var]})
                fig.update_yaxes(title='% dentro de cada resultado')
                st.plotly_chart(estilo(nombrar_clases(fig)))
            with col2:
                fig = px.box(sub_v, x='winner', y=var, color='winner', color_discrete_map=COLOR_CLASE,
                             category_orders=ORDEN_CLASES, title='Comparación por resultado',
                             labels={'winner': ''})
                fig.update_xaxes(tickvals=CLASSES, ticktext=[NOMBRE_CLASE[c] for c in CLASSES])
                fig.update_layout(showlegend=False)
                st.plotly_chart(estilo(fig))

            resumen = sub.groupby('winner')[var].describe().reindex(CLASSES)
            resumen.index = [NOMBRE_CLASE[c] for c in resumen.index]
            st.dataframe(resumen.style.format('{:,.2f}'))

            st.subheader('Relación entre dos variables')
            c1, c2 = st.columns(2)
            vx = c1.selectbox('Eje X', NUM_FEATURES, index=NUM_FEATURES.index('len_a'))
            vy = c2.selectbox('Eje Y', NUM_FEATURES, index=NUM_FEATURES.index('len_b'))
            muestra = sub.sample(min(len(sub), 4000), random_state=0)
            fig = px.scatter(muestra, x=vx, y=vy, color='winner', opacity=0.55,
                             color_discrete_map=COLOR_CLASE, category_orders=ORDEN_CLASES,
                             log_x=bool((muestra[vx] > 0).all() and muestra[vx].max() > 1000),
                             log_y=bool((muestra[vy] > 0).all() and muestra[vy].max() > 1000),
                             hover_data=['model_a', 'model_b'],
                             title=f'{vy} contra {vx} (muestra de {len(muestra):,})')
            st.plotly_chart(estilo(nombrar_clases(fig), 480))

            st.subheader('Correlaciones (Spearman)')
            corr = sub[NUM_FEATURES].assign(
                gana_A=(sub.winner == 'A').astype(int), gana_B=(sub.winner == 'B').astype(int),
                empate=(sub.winner == 'tie').astype(int)).corr(method='spearman')
            fig = px.imshow(corr, color_continuous_scale='RdBu_r', zmin=-1, zmax=1, aspect='auto',
                            text_auto='.2f')
            fig.update_traces(textfont_size=9)
            st.plotly_chart(estilo(fig, 650))
            max_rho = corr.loc[NUM_FEATURES, ['gana_A', 'gana_B', 'empate']].abs().max().max()
            st.caption('Las últimas tres columnas muestran qué variables se asocian con cada resultado: '
                       f'la correlación más fuerte es apenas |ρ| = {max_rho:.2f}, lo que explica por qué '
                       'ningún modelo logra una mejora grande.')

            with st.expander('Ver tabla de datos'):
                st.dataframe(sub.head(1000), hide_index=True)

# ---------------------------------------------------------------------------
# 3. Predicción de una batalla nueva
# ---------------------------------------------------------------------------
for k in ['prompt', 'resp_a', 'resp_b']:
    st.session_state.setdefault(k, '')
st.session_state.setdefault('real', None)


def cargar_ejemplo():
    fila = datos[2].sample(1).iloc[0]
    st.session_state.update(prompt=fila.prompt_text, resp_a=fila.response_a_text,
                            resp_b=fila.response_b_text, real=fila.winner,
                            modelos_reales=(fila.model_a, fila.model_b))


def limpiar():
    st.session_state.update(prompt='', resp_a='', resp_b='', real=None)


def intercambiar():
    s = st.session_state
    s.resp_a, s.resp_b = s.resp_b, s.resp_a
    if s.real in ('A', 'B'):
        s.real = 'B' if s.real == 'A' else 'A'
    if s.get('modelos_reales'):
        s.modelos_reales = s.modelos_reales[::-1]


def marcar_editado():
    st.session_state.real = None


with tab_predecir:
    st.header('¿Quién gana esta batalla?')
    st.markdown('Escribe un prompt y dos respuestas, o carga una batalla real del conjunto de prueba.')
    b1, b2, b3, _ = st.columns([1.2, 1, 1, 3])
    b1.button('🎲 Ejemplo real', on_click=cargar_ejemplo, disabled=datos is None,
              help=None if datos is not None else 'Requiere ejecutar preparar_datos.py')
    b2.button('⇄ Intercambiar A y B', on_click=intercambiar)
    b3.button('🧹 Limpiar', on_click=limpiar)

    st.text_area('Prompt del usuario', key='prompt', height=90, on_change=marcar_editado)
    ca, cb = st.columns(2)
    with ca:
        st.markdown(f"<h4 style='color:{COLOR_CLASE['A']};margin:0'>Respuesta A</h4>", unsafe_allow_html=True)
        st.text_area('Respuesta A', key='resp_a', height=260, label_visibility='collapsed',
                     on_change=marcar_editado)
    with cb:
        st.markdown(f"<h4 style='color:{COLOR_CLASE['B']};margin:0'>Respuesta B</h4>", unsafe_allow_html=True)
        st.text_area('Respuesta B', key='resp_b', height=260, label_visibility='collapsed',
                     on_change=marcar_editado)

    s = st.session_state
    if not s.resp_a.strip() or not s.resp_b.strip():
        st.info('Escribe ambas respuestas para obtener una predicción.')
    else:
        X = entrada_a_variables(s.prompt, s.resp_a, s.resp_b)
        probas = {n: predecir(modelos, n, X)[0] for n in seleccion}
        metricas = comparacion.set_index('modelo')

        if s.real:
            ma, mb = s.get('modelos_reales', ('?', '?'))
            st.success(f"Batalla real: **A = {ma}** vs **B = {mb}**. "
                       f"El humano votó: **{NOMBRE_CLASE[s.real]}**.")

        cols = st.columns(len(probas) + (1 if len(probas) > 1 else 0))
        for col, (nombre, p) in zip(cols, probas.items()):
            ganador = CLASSES[int(np.argmax(p))]
            acierto = '' if not s.real else (' ✅' if ganador == s.real else ' ❌')
            with col.container(border=True):
                st.markdown(f"<small style='color:{COLOR_MODELO[nombre]}'>■ {nombre}</small>",
                            unsafe_allow_html=True)
                st.markdown(f"<h3 style='color:{COLOR_CLASE[ganador]};margin:0'>"
                            f"{NOMBRE_CLASE[ganador]}{acierto}</h3>", unsafe_allow_html=True)
                st.caption(f'Confianza {p.max():.0%} · log loss en prueba '
                           f"{metricas.loc[nombre, 'log_loss']:.3f}")
        if len(probas) > 1:
            consenso = np.mean(list(probas.values()), axis=0)
            ganador = CLASSES[int(np.argmax(consenso))]
            acierto = '' if not s.real else (' ✅' if ganador == s.real else ' ❌')
            with cols[-1].container(border=True):
                st.markdown('<small>⚖️ Consenso (promedio)</small>', unsafe_allow_html=True)
                st.markdown(f"<h3 style='color:{COLOR_CLASE[ganador]};margin:0'>"
                            f"{NOMBRE_CLASE[ganador]}{acierto}</h3>", unsafe_allow_html=True)
                st.caption(f'Confianza {consenso.max():.0%}')
            probas = {**probas, 'Consenso': consenso}

        tabla = pd.DataFrame(probas, index=CLASSES).T.reset_index(names='modelo')
        largo = tabla.melt(id_vars='modelo', var_name='winner', value_name='p')
        fig = px.bar(largo, y='modelo', x='p', color='winner', orientation='h', barmode='stack',
                     color_discrete_map=COLOR_CLASE, category_orders=ORDEN_CLASES, text_auto='.0%',
                     title='Probabilidad asignada por cada modelo',
                     labels={'p': 'Probabilidad', 'modelo': ''})
        fig.update_layout(xaxis_tickformat='.0%', xaxis_range=[0, 1])
        fig.update_yaxes(categoryorder='array', categoryarray=list(probas)[::-1])
        st.plotly_chart(estilo(nombrar_clases(fig), 120 + 60 * len(probas)))

        a_larga = X['len_ratio'].iloc[0]
        if abs(a_larga) > 0.3:
            mas_larga = 'A' if a_larga > 0 else 'B'
            st.markdown(f'📏 La respuesta **{mas_larga}** es {np.exp(abs(a_larga)):.1f}× más larga. '
                        'Por el sesgo de verbosidad, los modelos tienden a favorecerla.')
        else:
            st.markdown('📏 Las respuestas tienen longitud similar: es el caso más difícil y los '
                        'modelos quedan cerca de 33% para cada clase.')

        with st.expander('🔬 Ver las variables que calculó el preprocesamiento'):
            vista = X[NUM_FEATURES].T.rename(columns={0: 'valor'})
            vista['descripción'] = [DESCRIPCIONES[v] for v in vista.index]
            st.dataframe(vista)

# ---------------------------------------------------------------------------
# 4. Rendimiento de los modelos en el conjunto de prueba
# ---------------------------------------------------------------------------
with tab_rendimiento:
    st.header('¿Qué tan buenos son los modelos?')
    if not mostrar_rendimiento:
        st.info('El rendimiento está oculto. Actívalo con **Mostrar rendimiento de los modelos** '
                'en la barra lateral.')
    else:
        st.markdown('Evaluación sobre el **20% de prueba** (11,494 batallas que ningún modelo vio al '
                    'entrenar). La métrica principal es la **log loss** (menor es mejor), la misma de '
                    'la competencia de Kaggle.')
        comp = comparacion.copy()
        comp['seleccionado'] = comp['modelo'].isin(seleccion + [BASELINE])
        metrica = st.segmented_control(
            'Métrica', ['log_loss', 'accuracy', 'f1_macro', 'seg_entrenamiento'], default='log_loss',
            format_func={'log_loss': 'Log loss', 'accuracy': 'Exactitud', 'f1_macro': 'F1 macro',
                         'seg_entrenamiento': 'Tiempo de entrenamiento (s)'}.get) or 'log_loss'
        ascendente = metrica in ('log_loss', 'seg_entrenamiento')
        orden = comp.sort_values(metrica, ascending=not ascendente)
        fig = px.bar(orden, x=metrica, y='modelo', orientation='h', color='modelo',
                     color_discrete_map=COLOR_MODELO, text_auto='.3f' if metrica != 'seg_entrenamiento' else '.1f',
                     labels={'modelo': ''}, log_x=metrica == 'seg_entrenamiento')
        fig.update_traces(marker_opacity=[1 if s else 0.3 for s in orden['seleccionado']])
        if metrica == 'log_loss':
            fig.add_vline(np.log(3), line_dash='dash', line_color='#C44E52',
                          annotation_text='azar: ln(3)', annotation_position='top')
            fig.update_xaxes(range=[1.0, 1.11])
        fig.update_layout(showlegend=False)
        st.plotly_chart(estilo(fig, 330))
        st.caption('Los modelos no seleccionados en la barra lateral aparecen atenuados. '
                   '“HistGradientBoosting” es la versión sin ajustar, incluida como referencia.')
        st.dataframe(comparacion.style.format({'log_loss': '{:.4f}', 'accuracy': '{:.3f}',
                                               'f1_macro': '{:.3f}', 'seg_entrenamiento': '{:.1f}'})
                     .highlight_min('log_loss', color='#D7EFE9'), hide_index=True)

        if datos is None:
            st.info(AVISO_DATOS)
        else:
            df, pred_test, _, _ = datos
            y = pred_test['real'].values
            P = {n: pred_test[[f'{n}|{c}' for c in CLASSES]].values for n in [BASELINE] + seleccion}

            st.subheader('Detalle por clase')
            filas = []
            for n in seleccion:
                pr, rc, f1, _ = precision_recall_fscore_support(
                    y, np.array(CLASSES)[P[n].argmax(1)], labels=CLASSES, zero_division=0)
                for i, c in enumerate(CLASSES):
                    filas += [dict(modelo=n, clase=NOMBRE_CLASE[c], métrica=m, valor=v)
                              for m, v in [('Precisión', pr[i]), ('Exhaustividad', rc[i]), ('F1', f1[i])]]
            fig = px.bar(pd.DataFrame(filas), x='clase', y='valor', color='modelo', barmode='group',
                         facet_col='métrica', color_discrete_map=COLOR_MODELO, text_auto='.2f',
                         labels={'clase': '', 'valor': ''})
            fig.for_each_annotation(lambda a: a.update(text=a.text.split('=')[-1]))
            st.plotly_chart(estilo(fig, 400))
            st.caption('El empate tiene la exhaustividad más baja en todos los modelos: es la clase que '
                       'más cuesta reconocer.')

            col1, col2 = st.columns(2)
            with col1:
                nombre_cm = st.selectbox('Matriz de confusión de', seleccion)
                normalizar = st.toggle('Mostrar porcentajes por fila', value=True)
                pred_cm = np.array(CLASSES)[P[nombre_cm].argmax(1)]
                cm = confusion_matrix(y, pred_cm, labels=CLASSES)
                z = cm / cm.sum(1, keepdims=True) if normalizar else cm
                etiquetas = [NOMBRE_CLASE[c] for c in CLASSES]
                fig = px.imshow(z, x=etiquetas, y=etiquetas, text_auto='.1%' if normalizar else 'd',
                                color_continuous_scale=['#F7F9FC', COLOR_MODELO[nombre_cm]],
                                labels=dict(x='Predicción', y='Real', color=''))
                fig.update_layout(coloraxis_showscale=False, title=nombre_cm)
                st.plotly_chart(estilo(fig, 420))
            with col2:
                nombre_cal = st.selectbox('Curva de calibración de', seleccion, key='cal')
                fig = go.Figure()
                for i, c in enumerate(CLASSES):
                    fp, mp = calibration_curve((y == c).astype(int), P[nombre_cal][:, i],
                                               n_bins=10, strategy='quantile')
                    fig.add_scatter(x=mp, y=fp, mode='lines+markers', name=NOMBRE_CLASE[c],
                                    line_color=COLOR_CLASE[c])
                fig.add_scatter(x=[0, 1], y=[0, 1], mode='lines', name='Perfecta',
                                line=dict(dash='dash', color='#888'))
                fig.update_layout(title=nombre_cal, xaxis_title='Probabilidad predicha',
                                  yaxis_title='Frecuencia observada',
                                  xaxis_range=[0, 0.8], yaxis_range=[0, 0.8])
                st.plotly_chart(estilo(fig, 420))
                st.caption('Si los puntos siguen la diagonal, cuando el modelo dice “40%” acierta '
                           '~40% de las veces. Una buena calibración es lo que mejora la log loss.')

            st.subheader('¿Dónde aciertan los modelos? El sesgo de verbosidad, otra vez')
            m = pred_test[['id']].merge(df[['id', 'len_ratio']], on='id', how='left')
            grupo = pd.cut(m['len_ratio'], BINS_LEN, labels=ETIQ_LEN)
            filas = []
            for n in [BASELINE] + seleccion:
                acierto = np.array(CLASSES)[P[n].argmax(1)] == y
                for g in ETIQ_LEN:
                    mask = (grupo == g).values
                    filas.append(dict(modelo=n, grupo=g, exactitud=acierto[mask].mean(),
                                      log_loss=log_loss(y[mask], P[n][mask], labels=CLASSES),
                                      n=int(mask.sum())))
            t = pd.DataFrame(filas)
            met = st.segmented_control('Mostrar', ['exactitud', 'log_loss'], default='exactitud',
                                       format_func={'exactitud': 'Exactitud', 'log_loss': 'Log loss'}.get,
                                       key='met_grupo') or 'exactitud'
            fig = px.line(t, x='grupo', y=met, color='modelo', markers=True,
                          color_discrete_map=COLOR_MODELO, custom_data=['n'],
                          labels={'grupo': 'Longitud relativa de las respuestas', met: met.replace('_', ' ')})
            fig.update_traces(hovertemplate='%{x}<br>%{y:.3f} (%{customdata[0]:,} batallas)')
            if met == 'exactitud':
                fig.update_layout(yaxis_tickformat='.0%')
            st.plotly_chart(estilo(fig, 420))
            st.markdown('Los modelos aciertan mucho más cuando una respuesta es claramente más larga '
                        'que la otra, y se acercan al azar cuando las longitudes son similares: '
                        'reproducen el sesgo de verbosidad del voto humano.')

            st.subheader('¿Qué tan seguros están?')
            conf = pd.concat([pd.DataFrame({'modelo': n, 'confianza': P[n].max(1)}) for n in seleccion])
            fig = px.histogram(conf, x='confianza', color='modelo', barmode='overlay', nbins=50,
                               opacity=0.6, color_discrete_map=COLOR_MODELO, histnorm='percent',
                               labels={'confianza': 'Probabilidad de la clase predicha'})
            fig.add_vline(1 / 3, line_dash='dot', line_color='#888', annotation_text='1/3')
            fig.update_yaxes(title='% de batallas')
            st.plotly_chart(estilo(fig, 360))
            st.caption('Casi todas las predicciones están entre 35% y 60%: los modelos son prudentes, '
                       'lo cual es correcto dado lo débiles que son las señales.')
