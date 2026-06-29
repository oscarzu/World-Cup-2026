# Publicación para LinkedIn


## Español

¿Qué haces cuando faltan datos: los estimas o esperas hasta que estén disponibles? 🤔

Construí un dashboard del Mundial 2026 como proyecto personal y terminó siendo un buen recordatorio de que la limpieza y precisión en los datos debe de ser el punto de partida no negociable en cualquier proyecto, ya que de nada sirve tener gráficos increibles y una web responsiva si el raw data no es confiable.

Lo técnico, en una línea:
Datos casi en vivo de ESPN > Cloudflare Worker + KV > un mismo *snapshot* para todos (una sola lectura a la fuente).
Modelo de predicciones 
Visualización con intención: cada gráfica, una sola idea.

Pero la mejor lección no fue de código. Una gráfica llegó a mostrar fases de eliminación **que aún no se jugaban** (datos "ilustrativos" que yo mismo había metido). En vez de maquillarlo, lo reescribí para calcular métricas **reales por fase** y no graficar una ronda hasta que termina.

La integridad del dato no es un *feature*: es la base.

🔗 En vivo: https://oscarzu.github.io/World-Cup-2026/

Y tú, ¿estimas o esperas? 👇

#DataEngineering #DataVisualization #MachineLearning #Analytics #DataIntegrity

