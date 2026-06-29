# World Cup 2026 — Dashboard interactivo ⚽

Dashboard **responsive**, **bilingüe (ES/EN)**, con **modo oscuro/claro** y enfoque de
**data storytelling**, que muestra estadísticas de la **Copa Mundial de la FIFA 2026**
(Canadá · México · USA · 11 jun – 19 jul 2026) con datos reales casi en vivo.

🔗 **En vivo:** https://oscarzu.github.io/World-Cup-2026/

Sin paso de build: HTML + CSS + JavaScript (ES modules) y [Chart.js](https://www.chartjs.org/)
por CDN. Se despliega tal cual en GitHub Pages. Los datos en vivo llegan a través de un
**Cloudflare Worker** (ver [`worker/`](worker/)).

## Características

Seis pestañas: **Resumen · Estadísticas · Partidos · Grupos · Goleadores · Sedes**.

- **Resumen (home)** — cifras clave, titular dinámico y franja de *insights* (estilo
  data-journalism). Trae la **caja de partidos en vivo** (aparece solo cuando hay juego),
  el **goleo por fase** (escala logarítmica, con *drill-down* a goles por jornada) y el
  **modelo de predicciones** con su comparativo **pronóstico vs. resultado real**.
- **Estadísticas** — el corazón del proyecto:
  - KPIs del torneo y **datos curiosos** (partido más goleador, remontadas, hat-tricks,
    gol más madrugador/tardío con minuto exacto…).
  - **Agregados** (fueras de lugar, VAR, goles anulados/restituidos, tarjetas, faltas,
    corners, atajadas, asistencia…).
  - Gráficas con **etiquetas directas**, color-señal + contexto y *drill-down* al detalle.
  - **Disciplina y eficacia**: faltas **por partido** (normalizadas), **% de conversión**
    (goles ÷ tiros a puerta), top-10 más/menos eficaces, **rojas por selección**, lesiones
    y una gráfica **dumbbell de eficacia por fase** (datos reales del Worker; ver abajo).
- **Partidos** — calendario agrupado por ronda con **fecha y hora** por partido, más el
  **bracket** de eliminatorias (con número de partido para rastrear cada cruce) en la
  misma pestaña, vía control segmentado. Calendario `.ics` **descargable y suscribible**
  (bilingüe, con banderas, sede y transmisión).
- **Grupos** — tablas de clasificación + **cómo terminó cada grupo** (Avanzó / Avanzó
  como mejor 3.º / Eliminado, con certeza).
- **Goleadores** — orden oficial FIFA; al hacer clic, **contra qué selecciones marcó**
  cada jugador.
- **Sedes** — los 16 estadios con foto, datos y un dato curioso.
- **Reglamento** — 13 reglas verificadas contra el [reglamento oficial FIFA 26](docs/Reglamento_WC26.pdf).

## Arquitectura de datos

```
            cron cada 3 min (un solo consumidor)        lecturas ilimitadas, 0 costo
ESPN ─────────────────────────────────────▶ Cloudflare Worker ──▶ KV ──▶ navegador (snapshot)
                                                │
                                                ├─ acumula nuestro propio dataset (agg)
                                                ├─ /efficacy.json (conversión real por fase)
                                                └─ calendar:es / calendar:en (.ics suscribible)
openfootball ──▶ raw.githubusercontent ──▶ navegador (calendario base / respaldo)
```

> El Worker escribe en KV **solo cuando el contenido cambia**, para respetar el límite
> gratuito (1000 puts/día).

El Worker es el **único** que llama a ESPN; guarda un *snapshot* normalizado en **KV** y
todos los visitantes leen lo mismo (idéntico, a prueba de recargas, sin multiplicar
peticiones por usuario). Con un contador diario nunca se exceden los límites.

## Fuentes de datos

| Fuente | Uso | Tipo |
| --- | --- | --- |
| ESPN | En vivo: marcadores, goles, faltas, tiros, tarjetas | **Real** · datos del torneo |
| [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) | Calendario / resultados base | **Real** · dominio público |
| Worker `/efficacy.json` | Eficacia (conversión) **real por fase** desde tiros a puerta capturados | **Real** (cuando el Worker está desplegado) |
| `data/teamstats.json` | Faltas/tiros/rojas/lesiones por selección | **Estimado** (fallback) cuando no hay proveedor en vivo |
| `data/efficacy-history.json` | Eficacia por fase (respaldo) | **Ilustrativo** (solo si el Worker no responde) |
| `data/social.json` | Posts de Instagram curados por fecha | Curado a mano |
| [reglamento oficial FIFA 26](docs/Reglamento_WC26.pdf) | Fuente base de las reglas | **Oficial** |
| [flagcdn.com](https://flagcdn.com) | Banderas | — |

### Integridad de los datos (importante)

Para evitar mostrar información imprecisa, el dashboard **distingue datos reales de
estimados**:

- **Reales (ESPN):** marcadores en vivo, goles, faltas y tiros por partido, tarjetas
  amarillas y **rojas** por selección — disponibles cuando el Worker está desplegado.
- **Estimados/ilustrativos:** si no hay proveedor en vivo, la capa de disciplina usa
  `teamstats.json` (valores conservadores y **claramente etiquetados** como estimados).
  Las **lesiones graves** no tienen un feed público fiable, así que se curan a mano.
- Toda sección estimada lo dice explícitamente en su nota al pie; no se presentan cifras
  inventadas como si fueran oficiales.

> Estrategia para no degradar la precisión: (1) preferir siempre el dato real de ESPN;
> (2) etiquetar lo estimado; (3) ampliar el recolector del Worker para capturar más
> métricas reales (las tarjetas rojas ya se capturan); (4) curar a mano solo lo que no
> tiene fuente, con su aviso.

## Estructura

```
index.html             Shell de la página (topbar + secciones)
css/styles.css         Sistema de diseño (tokens, dark/light, responsive)
js/config.js           Endpoints, metadatos (banderas, sedes), traducción de selecciones
js/i18n.js             Internacionalización ES/EN
js/api.js              Fetch + caché + normalización + carga de capas de datos
js/apifootball.js      Cliente del Worker (snapshot en vivo)
js/standings.js        Cálculo de tablas de grupos
js/qualification.js    Clasificación a R32 + resolución de llaves (1A, 3A/B/C, W##)
js/scorers.js          Goleadores, goles por fase y log por jugador
js/facts.js            Datos curiosos derivados de los resultados
js/discipline.js       Faltas/partido, % de conversión, rojas, lesiones
js/predictions.js      Modelo Poisson/Dixon–Coles + Elo + back-test walk-forward
js/calendar.js         Generación del calendario .ics (bilingüe, enriquecido)
js/render.js           Renderizado del DOM (bilingüe)
js/charts.js           Gráficas (Chart.js) con etiquetas directas
js/app.js              Orquestación: tabs, tema, idioma, polling en vivo, drill-downs
model.html             Página de datos del modelo (metodología, Elo, back-test)
data/                  worldcup.json + capas curadas
docs/                  Reglamento oficial (PDF) + informe de métricas
worker/                Cloudflare Worker (recolector ESPN + KV + cron + /efficacy + .ics)
```

## Cómo ejecutar localmente

```bash
python3 -m http.server 8000   # los ES modules requieren http://
# abre http://localhost:8000
```

## Desplegar

1. **GitHub Pages:** *Settings → Pages → Source: GitHub Actions*. El workflow
   `.github/workflows/deploy.yml` publica en cada push a `main`.
2. **Datos en vivo (opcional):** despliega el Worker siguiendo
   [`worker/README.md`](worker/README.md) y pega su URL en `CONFIG.LIVE_PROXY_URL`
   (`js/config.js`). Sin esto, el sitio funciona con los datos base + estimados.

---

## 📖 La historia del proyecto

**Cómo empezó.** La idea fue tener un panel personal de la Copa del Mundo 2026: claro,
bonito y con datos de verdad. El primer paso fue migrar un dashboard que vivía en otro
repositorio (`ETL-Project`) hacia este, dejándolo listo para GitHub Pages.

**Los obstáculos — y cómo los resolvimos.**

1. **GitHub Pages no publicaba.** El primer deploy fallaba con *“Get Pages site failed”*.
   Resultó que Pages no estaba habilitado con *GitHub Actions* como fuente. Una vez
   activado, el sitio salió a producción.
2. **Sin datos reales de 2026.** Intentamos *API-Football*, pero su **plan gratuito no da
   acceso a la temporada 2026** (solo 2022–2024). En lugar de pagar, optamos por traer los
   **datos de ESPN**, que sí cubren el torneo.
3. **Que el dato fuera el mismo para todos y no agotara cuotas.** Montamos un **Cloudflare
   Worker con KV + un cron** cada 3 min: el servidor consulta una sola vez y todos leen el
   mismo *snapshot*. De paso, el Worker **acumula nuestro propio dataset** del torneo. Más
   adelante, cuando Cloudflare avisó de un exceso de escrituras, se ajustó para **escribir
   en KV solo cuando el contenido cambia** (dentro del tope gratuito).
4. **Tropiezos de entorno.** Node sin instalar, `wrangler` fuera del PATH, un repositorio
   git local corrupto (*bad object*)… se resolvieron con `npx`, reinstalación de Node y un
   re-clonado limpio.
5. **Instagram.** Meta cerró el descubrimiento de publicaciones por ubicación/hashtag para
   terceros. La solución honesta: un **archivo social que se arma solo por jornada y sede**
   (con los partidos del día), al que se le pueden enganchar posts o un widget.
6. **Precisión de los datos.** Algunas métricas estaban fabricadas y podían contradecir la
   realidad (p. ej. tarjetas rojas). Lo corregimos con una **política de integridad**:
   real de ESPN siempre que se pueda, todo lo estimado **etiquetado**, y el recolector
   ampliado para capturar más métricas reales.

**Cómo evolucionó.** De un dashboard minimalista pasó a un producto de **data
storytelling**: etiquetas directas en las gráficas, color con intención, un titular por
visualización, franja de *insights*, métricas más rigurosas (faltas por partido, **% de
conversión**), **bilingüe ES/EN** y una capa en vivo robusta y compartida. Después llegó
otra ronda: un **modelo de predicciones** (Poisson/Dixon–Coles con prior Elo y validación
*walk-forward*), un **calendario `.ics` suscribible** y bilingüe, la **consolidación de
pestañas** (de 9 a 6, con el vivo y las predicciones en el home), las **reglas verificadas
contra el reglamento oficial de la FIFA**, y un compromiso firme con la **honestidad del
dato**: cuando una gráfica mostraba eliminatorias inexistentes, se reescribió para calcular
**eficacia real por fase** y no graficar ninguna ronda hasta que se completa.

**Status actual.** Funcionando y desplegado: datos reales de ESPN en vivo a través del
Worker, calendario base de openfootball, capas estimadas claramente señaladas, diseño
responsive con modo claro/oscuro e idioma conmutable. Listo para seguir creciendo durante
el torneo.

> Este es un proyecto personal, y la ayuda de **Claude Code** fue esencial para llevarlo a
> cabo: desde diagnosticar despliegues y diseñar la arquitectura en vivo, hasta el
> rediseño visual y la internacionalización.

**Autor:** Zuriel Santibañez.
