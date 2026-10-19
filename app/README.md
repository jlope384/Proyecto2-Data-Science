# Aplicación — Chatbot Arena

App en Streamlit que usa los modelos entrenados en `notebooks/Modelado_ChatbotArena.ipynb`
para predecir qué respuesta preferirá un humano (A, B o empate).

## Pestañas
- **📖 La historia**: hallazgos del EDA (sesgo de verbosidad y de formato, empates,
  tasa de victoria por chatbot) y qué aprendieron los modelos.
- **🔎 Explorar datos**: distribución de cada variable del modelo por resultado,
  dispersión entre dos variables, correlaciones y tabla filtrable.
- **🤖 Predecir**: escribe un prompt y dos respuestas (o carga una batalla real) y mira
  la predicción de cada modelo y del consenso. El preprocesamiento es automático.
- **📊 Rendimiento**: métricas, detalle por clase, matriz de confusión, calibración y
  exactitud según la longitud relativa, todo sobre el conjunto de prueba. Se puede
  ocultar desde la barra lateral.

En la barra lateral se elige usar un modelo, varios o todos.

## Cómo correrla
```bash
cd app
python -m venv .venv && .venv/Scripts/activate      # en Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt

streamlit run app.py
```

`app/datos/` ya viene en el repositorio. Solo hace falta regenerarlo si cambian los modelos:
```bash
python preparar_datos.py ../data/train.csv
```

`preparar_datos.py` repite la limpieza y la partición 80/20 del cuaderno (semilla 42) y
comprueba que sus predicciones coincidan con `notebooks/resultados_modelado/predicciones_prueba.csv`.
Sin `app/datos/`, la pestaña de predicción y la tabla de métricas funcionan igual,
pero la exploración y las gráficas de prueba piden correr ese script.

## Archivos
- `preprocesamiento.py`: misma ingeniería de variables que el cuaderno.
- `modelos.py`: registro y carga de los modelos `.joblib`.
- `preparar_datos.py`: genera los datos que usa la app.
- `app.py`: la aplicación.
