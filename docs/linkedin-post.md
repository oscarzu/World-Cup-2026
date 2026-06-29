# Borradores para LinkedIn

> Tono personal, congruente con la voz del proyecto (reflexiva, honesta, de
> _maker_). Elige el que más te suene; ambos llevan el mismo enlace y CTA.

---

## Versión principal (ES)

🏆 Mi panel del Mundial 2026 — un proyecto personal que se me fue de las manos, para bien.

Quería algo simple: seguir la Copa con datos de verdad, bonito y claro. Terminó siendo un ejercicio de ingeniería de datos de punta a punta.

Qué hace:
• Datos casi en vivo (marcadores, goles, tarjetas, tiros) desde la API pública de ESPN — sin API key y sin costo.
• Un Cloudflare Worker + KV que consulta una sola vez y sirve el mismo snapshot a todos… respetando los límites del plan gratuito.
• Bilingüe ES/EN, modo claro/oscuro y enfoque de _data storytelling_: cada gráfica cuenta una idea.
• Un modelo de predicciones (Poisson/Dixon–Coles con prior Elo) validado _walk-forward_, sin hacerme trampas.

Pero lo que más me llevo es una lección sobre honestidad del dato. En un punto, una gráfica mostraba rondas de eliminación que aún no se jugaban (datos "ilustrativos" que yo mismo había puesto). En vez de maquillarlo, lo reescribí para calcular la eficacia real por fase y no graficar ninguna ronda hasta que termina. Prefiero un dashboard que diga "todavía no" a uno que invente.

Hecho con HTML/CSS/JS vanilla + Chart.js y desplegado en GitHub Pages. Buena parte del camino —arquitectura, diagnóstico de despliegues, rediseño visual— la trabajé con Claude Code, y fue un acelerador brutal.

🔗 En vivo: https://oscarzu.github.io/World-Cup-2026/
💻 Código: https://github.com/oscarzu/World-Cup-2026

¿Comentarios o ideas? Los recibo con gusto. 👇

#DataEngineering #DataVisualization #WorldCup2026 #CloudflareWorkers #JavaScript #SideProject #Futbol

---

## Versión corta (ES)

Construí un panel del Mundial 2026, por gusto. ⚽📊

Datos casi en vivo de la API pública de ESPN (sin API key), servidos a todos por igual con un Cloudflare Worker + KV; bilingüe, claro/oscuro, con un modelo de predicciones validado sin trampas.

La mejor lección no fue técnica: una gráfica mostraba datos de rondas que aún no se jugaban. Lo reescribí para calcular solo lo real y no graficar una fase hasta que termina. Mejor decir "todavía no" que inventar.

🔗 https://oscarzu.github.io/World-Cup-2026/
💻 https://github.com/oscarzu/World-Cup-2026

#DataEngineering #DataVisualization #WorldCup2026 #SideProject

---

## English version

🏆 A personal World Cup 2026 dashboard — a side project that grew on me.

I wanted something simple: follow the tournament with real data, clean and good-looking. It turned into an end-to-end data project.

What it does:
• Near-live data (scores, goals, cards, shots) from ESPN's public API — no API key, no cost.
• A Cloudflare Worker + KV that calls the source once and serves the same snapshot to everyone, within the free tier's limits.
• Bilingual (ES/EN), dark/light, and a data-storytelling approach: each chart makes one point.
• A prediction model (Poisson/Dixon–Coles with an Elo prior), validated walk-forward — no cheating.

My biggest takeaway, though, was about data honesty. At one point a chart showed knockout rounds that hadn't been played yet ("illustrative" numbers I'd put in myself). Instead of dressing it up, I rewrote it to compute real per-phase efficiency and to show no round until it's actually complete. I'd rather a dashboard that says "not yet" than one that makes things up.

Built with vanilla HTML/CSS/JS + Chart.js, deployed on GitHub Pages. A lot of the work — architecture, deploy debugging, visual redesign — I did with Claude Code, and it was a huge accelerator.

🔗 Live: https://oscarzu.github.io/World-Cup-2026/
💻 Code: https://github.com/oscarzu/World-Cup-2026

Feedback welcome. 👇

#DataEngineering #DataVisualization #WorldCup2026 #CloudflareWorkers #JavaScript #SideProject
