# Publicación para LinkedIn


---

## Español

¿Qué haces cuando faltan datos: los estimas o esperas hasta que estén disponibles? 🤔

Construí un panel del Mundial 2026 como proyecto personal y terminó siendo un buen recordatorio de algo que en el mundo de los datos damos por setnado **la limpieza en los datos fuente siempre .**

Lo técnico, en una línea:
📥 datos casi en vivo de ESPN → ⚙️ Cloudflare Worker + KV → un mismo *snapshot* para todos (una sola lectura a la fuente).
🔮 un modelo de predicciones (Poisson/Dixon–Coles + prior Elo) validado *walk-forward*: sin fuga de información, sin overfitting.
📊 visualización con intención: cada gráfica, una sola idea.

Pero la mejor lección no fue de código. Una gráfica llegó a mostrar fases de eliminación **que aún no se jugaban** (datos "ilustrativos" que yo mismo había metido). En vez de maquillarlo, lo reescribí para calcular métricas **reales por fase** y no graficar una ronda hasta que termina.

Prefiero un tablero que diga "todavía no" a uno que rellene huecos. La integridad del dato no es un *feature*: es la base.

🔗 En vivo: https://oscarzu.github.io/World-Cup-2026/

Y tú, ¿estimas o esperas? 👇

#DataEngineering #DataVisualization #MachineLearning #Analytics #DataIntegrity

---

## English

When data is missing, do you estimate it… or wait for it? 🤔

I built a World Cup 2026 dashboard as a personal project, and it became a sharp reminder of something we take for granted in data but rarely hold the line on: **show only what actually happened.**

The technical part, in one line:
📥 near-live data from ESPN → ⚙️ Cloudflare Worker + KV → one shared *snapshot* for everyone (a single read at the source).
🔮 a prediction model (Poisson/Dixon–Coles + Elo prior), validated *walk-forward*: no leakage, no overfitting.
📊 charts with intent: one idea per chart.

But the best lesson wasn't about code. One chart ended up showing knockout rounds **that hadn't been played yet** ("illustrative" numbers I'd added myself). Instead of dressing it up, I rewrote it to compute **real per-phase metrics** and to show no round until it's actually complete.

I'd rather a dashboard that says "not yet" than one that fills the gaps. Data integrity isn't a feature — it's the foundation.

🔗 Live: https://oscarzu.github.io/World-Cup-2026/

So — do you estimate, or do you wait? 👇

#DataEngineering #DataVisualization #MachineLearning #Analytics #DataIntegrity
