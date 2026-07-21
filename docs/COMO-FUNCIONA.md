# 🧭 Cómo funciona el proyecto (explicado sencillo)

> Guía para entender **qué hace cada pieza** y **los términos técnicos**, sin
> asumir conocimientos previos. Al final hay un **glosario**.

> 🏆 **El torneo terminó** (España, campeona). El sitio está en **modo archivo**:
> lee solo datos congelados y no hace llamadas a APIs. Lo de abajo describe cómo
> operaba en vivo; el cierre está en [`RETROSPECTIVA.md`](RETROSPECTIVA.md).

---

## 1. La idea en una frase

Es una **página web** que muestra estadísticas del Mundial 2026 con datos casi
en vivo. No hay servidor propio "encendido" todo el día: la página es estática y
los datos en vivo los prepara un pequeño programa en la nube (un *Worker*) que
consulta a ESPN y guarda el resultado para que **todos vean lo mismo**.

---

## 2. Las tres piezas (con analogía)

Imagina un restaurante:

| Pieza | Qué es | Analogía |
|---|---|---|
| **Frontend** (`index.html`, `css/`, `js/`) | Lo que ves y usas en el navegador | El **comedor**: mesas, menú, presentación |
| **Worker + KV** (`worker/`) | Programa en la nube que trae y guarda datos | La **cocina + refrigerador**: prepara una vez y sirve a todos |
| **Fuentes de datos** (ESPN, openfootball) | De dónde salen los resultados | Los **proveedores** de ingredientes |

- El **frontend** vive en **GitHub Pages** (hosting gratis de GitHub). Es
  HTML + CSS + JavaScript "puro" (sin frameworks, sin paso de compilación).
- El **Worker** vive en **Cloudflare**. Es el único que habla con ESPN, y guarda
  un **snapshot** (foto) de los datos en **KV** (una base de datos tipo
  "diccionario": clave → valor).
- El navegador de cada visitante **solo lee** ese snapshot: rápido, idéntico
  para todos y sin saturar a ESPN.

---

## 3. El flujo de datos, paso a paso

```
1) Cada 3 minutos, un "cron" despierta al Worker.
2) El Worker llama a ESPN UNA vez y normaliza la respuesta.
3) Guarda en KV: marcadores en vivo, un dataset propio acumulado (agg),
   el calendario .ics y la eficacia por fase.
   → Solo escribe si el contenido cambió (para no gastar el límite gratis).
4) Tu navegador abre la página (GitHub Pages) y lee esos datos ya listos.
5) El JavaScript los transforma en tablas, gráficas, bracket, predicciones…
```

Además, el **calendario base** (fechas y llaves) viene de **openfootball** (un
proyecto de datos de fútbol de dominio público), y sirve de respaldo si ESPN
falla.

---

## 4. ¿Qué hace el JavaScript del frontend? (por archivos)

- `api.js` — trae los datos y los **normaliza** (los deja en un formato único).
  Ej.: para eliminatorias, usa el marcador de **prórroga** como resultado final.
- `standings.js` / `qualification.js` — calcula tablas de grupos y **quién
  avanza** (incluye desempates y resolución de llaves: 1A, 3A/B/C, W97…).
- `scorers.js` — goleadores y goles por fase.
- `facts.js` / `discipline.js` — datos curiosos, faltas, tarjetas, eficacia.
- `predictions.js` — el **modelo** de predicción (ver §6).
- `charts.js` — dibuja las gráficas (con Chart.js).
- `render.js` — convierte datos en HTML (el bracket, las cards, etc.).
- `calendar.js` — arma el archivo `.ics` descargable.
- `app.js` — el "director de orquesta": pestañas, tema, idioma, ciclo de
  actualización en vivo.

---

## 5. ¿Cómo se actualiza el sitio? (importante)

Hay **dos cosas separadas** que se despliegan por caminos distintos:

| Cambias… | Se publica… | Cómo |
|---|---|---|
| Frontend (`index.html`, `css/`, `js/`, `data/`) | **Automático** | Al hacer *push* a `main`, GitHub Actions publica en GitHub Pages (1–2 min) |
| Worker (`worker/worker.js`) | **Manual** | Debes correr `npx wrangler deploy` desde `worker/` |

> Por eso, a veces un cambio del **calendario** (que vive en el Worker) no se ve
> hasta que **redespliegas el Worker**, aunque el código ya esté en GitHub.

Y un tercer detalle: si estás **suscrito** al calendario, tu app de calendario
(Google/Apple) re-descarga el feed **en su propio horario** (Google puede tardar
horas). Los cambios llegan, pero no al instante.

---

## 6. El modelo de predicciones (sin miedo a los términos)

Predice cada partido con un modelo **Poisson** (una fórmula estándar para contar
goles). Mejoras clave:

- **Prior Elo**: antes de que empiece el torneo, cada selección arranca con una
  fuerza estimada (estilo ranking). Evita locuras con pocos partidos.
- **Shrinkage** (encogimiento): mezcla la forma reciente con ese prior, para no
  **sobreajustar** (no creerle demasiado a 1–2 partidos).
- **Dixon–Coles**: una corrección para marcadores bajos (0-0, 1-0…).
- **Eliminatorias sin empate**: reparte la probabilidad entre prórroga y
  **penales** (cada selección tiene un rating de tanda).
- **Validación walk-forward**: para medir si el modelo sirve, "viaja al pasado"
  y predice cada partido usando **solo lo anterior** a ese partido (sin hacer
  trampa mirando el futuro). Se mide con métricas honestas (RPS, Brier).

---

## 7. Glosario rápido

- **Frontend / Backend**: lo que corre en tu navegador / lo que corre en un
  servidor. Aquí el "backend" es mínimo: solo el Worker.
- **API**: una forma de pedir datos a otro sistema por internet (ESPN nos da
  JSON).
- **JSON**: formato de datos en texto (listas y pares clave-valor).
- **Cloudflare Worker**: un pequeño programa que corre en la nube de Cloudflare,
  cerca del usuario, sin administrar servidores.
- **KV (key-value)**: almacenamiento tipo diccionario (clave → valor). Guardamos
  ahí el snapshot. El plan gratis permite ~1000 escrituras/día → por eso solo
  escribimos cuando el contenido cambia.
- **Cron**: un temporizador que ejecuta algo cada cierto tiempo (aquí, cada 3
  min).
- **Snapshot**: una "foto" de los datos en un momento; todos leen la misma.
- **CDN**: red que sirve archivos rápido desde muchos lugares (Chart.js viene de
  un CDN).
- **GitHub Pages**: hosting gratuito de páginas estáticas desde un repo.
- **GitHub Actions**: automatiza tareas (aquí, publicar el sitio en cada push).
- **ES Modules**: forma moderna de dividir el JavaScript en archivos con
  `import`/`export`.
- **Responsive**: que se adapta a móvil y escritorio.
- **i18n**: "internacionalización" (18 letras entre la i y la n); aquí, ES/EN.
- **.ics / webcal**: formato y protocolo estándar de calendarios (para
  suscribirte).
- **Poisson / Dixon–Coles / Elo**: herramientas estadísticas del modelo (§6).
- **Overfitting (sobreajuste)**: cuando un modelo "memoriza" el pasado y falla
  en lo nuevo. Lo evitamos con prior + shrinkage + parámetros fijos.
- **Walk-forward**: validar prediciendo hacia adelante en el tiempo, sin
  mirar el futuro.

---

## Para profundizar

- **Arquitectura y fuentes**: [`README.md`](../README.md)
- **Detalle del Worker**: [`worker/README.md`](../worker/README.md)
- **Informe de métricas**: [`INFORME.md`](INFORME.md)
- **Reglamento oficial**: [`Reglamento_WC26.pdf`](Reglamento_WC26.pdf)
