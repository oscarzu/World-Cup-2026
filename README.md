# World Cup 2026 — Dashboard interactivo ⚽

Dashboard **responsive**, con **modo oscuro** y estilo **minimalista** que muestra en
(casi) tiempo real las estadísticas de la **Copa Mundial de la FIFA 2026**
(Canadá · México · USA, 11 jun – 19 jul 2026).

Sin backend, **sin API key** y sin paso de build: HTML + CSS + JavaScript (ES modules)
y [Chart.js](https://www.chartjs.org/) por CDN. Se despliega tal cual en GitHub Pages.

## Características

- **Resumen** del torneo con cifras clave y goleo por jornada.
- **Partidos** en vivo / próximos / finalizados con marcadores y goleadores, búsqueda por
  selección y filtro por fase.
- **Grupos** (A–L): tablas calculadas en el cliente con criterios FIFA (Pts → DG → GF) y
  resaltado de clasificados.
- **Eliminatorias** (dieciseisavos → final) con avance por marcador.
- **Goleadores** acumulados a partir de los eventos de gol.
- **Sedes**: los 16 estadios anfitriones.
- **Estadísticas** con gráficas (Chart.js) que se re-tematizan al cambiar de tema.
- **Modo oscuro/claro** persistente, respeta `prefers-color-scheme` y `prefers-reduced-motion`.

## Fuentes de datos (gratuitas, sin key, CORS-safe)

| Fuente | Uso | Notas |
| --- | --- | --- |
| [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) | Base: partidos, grupos, resultados, goles | Dominio público, servido por `raw.githubusercontent.com`. Actualizado durante el torneo. |
| [worldcup26.ir](https://worldcup26.ir) (comunidad) | Capa en vivo (marcadores/estado) | CORS habilitado. **Best-effort**: si falla, la app sigue funcionando con la base. |
| `data/worldcup.json` | Snapshot offline | Para no fallar nunca si la red cae. |
| [flagcdn.com](https://flagcdn.com) | Banderas | Por código de país. |

> La capa en vivo es un complemento. El estado *EN VIVO* también se infiere de la hora de
> inicio cuando la API en vivo no está disponible, así que el indicador funciona igual.

## Cómo ejecutar localmente

Necesitas servirlo por HTTP (los ES modules no cargan con `file://`):

```bash
cd world-cup-2026
python3 -m http.server 8000
# abre http://localhost:8000
```

## Desplegar en GitHub Pages

1. Copia el contenido de esta carpeta a la **raíz** de un repo nuevo (p. ej. `World-Cup-2026`).
2. Mueve `.github/workflows/deploy.yml` a la raíz del repo y haz push a `main`.
3. En *Settings → Pages*, selecciona *GitHub Actions* como fuente.

## Estructura

```
index.html            Shell de la página (tabs + secciones)
css/styles.css        Sistema de diseño (tokens, dark/light, responsive)
js/config.js          Endpoints, TTLs y metadatos (banderas, sedes)
js/api.js             Fetch + caché + normalización + capa en vivo
js/standings.js       Cálculo de tablas de grupos
js/scorers.js         Goleadores y estadísticas de gol
js/render.js          Renderizado del DOM
js/charts.js          Gráficas (Chart.js)
js/app.js             Orquestación, tabs, tema, polling
data/worldcup.json    Snapshot de respaldo
```
