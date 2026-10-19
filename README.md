# Proyecto 2 — Chatbot Arena: predicción de preferencia humana

CC3084 Data Science · UVG · Grupo 5 (Javier López, Pedro Ávila, Brandon Rivera).

Dado un prompt y dos respuestas de LLM, predecir si una persona prefiere la respuesta A, la B o
declara empate (competencia de Kaggle *LMSYS – Chatbot Arena Human Preference Predictions*).

| Carpeta | Contenido |
|---|---|
| `notebooks/` | `ChatbotArena.ipynb` (EDA), `Modelado_ChatbotArena.ipynb` (modelos), `figuras_resultados.py`, `resultados_modelado/` (modelos `.joblib`, métricas y figuras) |
| `app/` | Aplicación en Streamlit: exploración, predicción y rendimiento ([instrucciones](app/README.md)) |
| `entregables/` | Informes PDF, presentaciones y capturas ([índice](entregables/README.md)) |
| `web/` | Blog en Astro con la presentación del EDA |

**Resultado principal:** la regresión logística con TF-IDF + variables estructurales (calibrada)
obtiene log loss 1.0414 y 47.3% de exactitud en prueba, frente a 1.0972 y 34.9% de la línea base.

Los datos (`train.csv`) no se versionan: descárgalos de Kaggle o de Hugging Face
(`lmsys/lmsys-arena-human-preference-55k`) y colócalos en `data/train.csv`.
