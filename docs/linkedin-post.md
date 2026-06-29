# Publicación para LinkedIn


¿Qué haces cuando los principales proveedores de noticias no muestran las estadisticas del mundial que te gustaria conocer a pesar de que cuentan con los datos disponibles para hacerlo? 🤔

Construí un dashboard del Mundial 2026 como proyecto personal, inicialmente queria saber que tanto afectaba el VAR esta edición del Mundial, y terminó siendo un buen recordatorio de que la limpieza y precisión en los datos debe de ser el punto de partida no negociable en cualquier proyecto, ya que de nada sirve tener gráficos increibles y una web responsiva si el raw data no es confiable.

Lo técnico, en una línea:
Datos casi en vivo de ESPN > Cloudflare Worker + KV > un mismo *snapshot* para todos (una sola lectura a la fuente).
Modelo de predicciones y visualización con intención: cada gráfica, una sola idea.

Pero la mejor lección no fue de código. Una gráfica llegó a mostrar fases de eliminación **que aún no se jugaban** (datos "ilustrativos" que yo mismo había metido). En lugar de conservarlo, lo reescribí para calcular métricas **reales por fase** y no graficar una ronda que aún no estuviera completa.

La integridad de los datos no es un *feature*: es la base.

Una feature que sí me gustó mucho fue poder hacer mi propio calendario que se actualiza conforme van avanzando los equipos en esta fase de eliminación. Tambien te puedes suscribir desde el home en el link del proyecto.

🔗 https://oscarzu.github.io/World-Cup-2026/


#DataEngineering #DataVisualization #MachineLearning #Analytics #DataIntegrity #AI

