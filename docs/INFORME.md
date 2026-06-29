# 📊 Informe del dashboard — World Cup 2026

> Generado para el proyecto **oscarzu/World-Cup-2026** · sitio en
> https://oscarzu.github.io/World-Cup-2026/ · datos en vivo vía Cloudflare Worker.

---

## 1. Resumen ejecutivo

Dashboard interactivo, bilingüe (ES/EN) y con tema claro/oscuro de la Copa
Mundial 2026. Se alimenta de datos de ESPN (a través de un Worker propio de
Cloudflare + KV) y de un calendario base de openfootball. Todo el
procesamiento de métricas ocurre en el cliente (JavaScript vanilla, sin
framework) y en el Worker (agregación y persistencia).

| Indicador | Valor |
|---|---|
| Pestañas | 6 (Resumen · Estadísticas · Partidos · Grupos · Goleadores · Sedes) |
| Gráficas | 11 lienzos Chart.js |
| Métricas deportivas rastreadas | ~40 (ver §3) |
| Idiomas | 2 (ES / EN) · 310 claves de traducción |
| Sedes documentadas | 16 (con foto, datos y dato curioso) |
| Módulos JS | 14 |
| Peso del front (sin comprimir) | ~300 KB · **~87 KB gzip** |
| Reglas verificadas contra el reglamento FIFA | 13 |

---

## 2. Arquitectura y fuentes de datos

```
ESPN  ──►  Cloudflare Worker (cron cada 3 min)
                          │   • snapshot en vivo (marcadores, tarjetas)
                          │   • agg: dataset propio acumulado
                          │     (goles, tiros a puerta, faltas, rojas por partido)
                          │   • calendar:es / calendar:en (.ics suscribible)
                          │   • /efficacy.json (conversión real por fase)
                          ▼
                       Cloudflare KV  (escritura solo si cambia el contenido,
                                        tope 1000 puts/día respetado)
                          ▼
   GitHub Pages (front) ◄── fetch snapshot/teamstats/efficacy + data/*.json de respaldo
```

- **Persistencia propia:** los datos se acumulan en *nuestra* KV (no dependemos
  de terceros en tiempo de carga). ESPN es solo la fuente que el Worker consulta.
- **Respaldo:** `data/*.json` en el repo (worldcup, teamstats, eficacia, social).
- **Reglamento oficial:** `docs/Reglamento_WC26.pdf` como fuente base de reglas.

---

## 3. Métricas deportivas que rastrea la página

### Resumen (home)
- KPIs del torneo: **selecciones, grupos, partidos, sedes, goles, goles/partido**.
- **Goleo por fase** (escala logarítmica, con drill-down a goles por jornada).
- Caja **en vivo** (marcadores) — visible solo cuando hay partido en juego.
- **Predicciones** + **pronóstico vs. resultado real** (validación del modelo).

### Estadísticas
- **KPIs:** jugados, goles totales, promedio, en vivo, finalizados, restantes.
- **Agregados del torneo:** fuera de lugar, goles anulados por VAR, goles
  restituidos por VAR, revisiones VAR, penales señalados, tarjetas amarillas,
  rojas, faltas, corners, atajadas, asistencia total.
- **Tiempo agregado:** promedio por partido + referencias 2018/2022 + por fase.
- **Curiosidades:** partido con más goles, mayor goleada, gol más madrugador y
  más tardío (con minuto exacto), hat-tricks, remontadas, tandas de penales,
  porterías a cero, 0-0, goleadas, goles de penal, selección más goleadora.
- **Disciplina:** faltas por partido (ranking), amarillas acumuladas en el
  torneo, rojas por selección, lesiones destacadas.
- **Eficacia (conversión = goles ÷ tiros a puerta):** top-10 más y menos
  eficaces, y **mejor vs. peor por fase** (gráfica dumbbell con datos reales).

### Partidos
- Calendario agrupado por ronda con **fecha y hora** por partido.
- Bracket de eliminatorias con número de partido (#) para rastrear cada cruce.

### Grupos
- Tablas de clasificación + **cómo terminó cada grupo** (Avanzó / Avanzó como
  mejor 3.º / Eliminado, con certeza).

### Goleadores
- Orden oficial FIFA (goles → asistencias → menos minutos). Drill-down: **contra
  qué selecciones marcó cada jugador** (rival, minuto, penal).

### Predicciones (modelo propio)
- Poisson con corrección Dixon–Coles, prior Elo + *shrinkage* (anti-overfitting),
  ponderación por recencia (forma). En eliminatorias reparte el empate entre
  prórroga y penales (rating de tanda por selección).
- **Validación walk-forward** (sin ver el futuro): acierto 1X2, marcador exacto,
  RPS/Brier/log-loss vs. baseline, nivel de confianza.

---

## 4. Inventario de visualizaciones

| Lienzo | Tipo | Qué muestra |
|---|---|---|
| chart-overview | Barras (log) | Goles por fase (grupos → final) |
| chart-groups | Barras | Goles por grupo |
| chart-teams | Barras horiz. | Selecciones más goleadoras |
| chart-moments | Barras | Momentos del torneo (orden desc., sin ceros) |
| chart-fouls | Barras horiz. | Faltas por partido |
| chart-cards | Barras horiz. | Amarillas acumuladas |
| chart-red | Barras horiz. | Rojas por selección |
| chart-eff-best / -worst | Barras horiz. | Top-10 más / menos eficaces |
| chart-eff-jornada / -cumulative | **Dumbbell** | Mejor vs. peor conversión por fase |
| (modal) md-zoom | Línea | Zoom a goles por jornada (J1–J17) |

**Auditoría de espaciado:** el único punto débil era la antigua gráfica de
eficacia (línea con puntos dispersos y etiquetas encimadas). Se reemplazó por
la dumbbell. El resto son barras (sin riesgo de superposición). La única línea
que queda es el zoom de jornadas, con 17 puntos densos — sin problema.

---

## 5. Métricas técnicas del sitio

| Métrica | Valor |
|---|---|
| HTML | 24 KB |
| CSS | 64 KB (1 096 líneas) |
| JS (14 módulos) | ~256 KB |
| Worker | 28 KB (546 líneas) |
| **Front total** | ~300 KB · **~87 KB gzip** |
| Dependencia externa | Chart.js 4.4.1 (CDN, defer) |
| Fuentes de datos en repo | 4 JSON + 1 PDF (reglamento) |
| Commits | 57 |

**Buenas prácticas presentes:** ARIA en tabs/charts, deep-linking por hash,
teclado en modales y pestañas, `prefers-color-scheme`, lazy-loading de
imágenes, `content-visibility` en listas largas, change-detection en KV para
respetar el límite gratuito, sin claves secretas en el repo.

---

## 6. Métricas de visitas (tráfico)

- **Cloudflare Web Analytics** activo (token configurado en `config.js`,
  beacon `beacon.min.js`). Privado, sin cookies ni PII.
- **Dónde verlas:** panel de Cloudflare → *Web Analytics* → dominio del sitio.
  Métricas disponibles ahí: visitas, page views, referrers, países,
  navegadores, Core Web Vitals.
- *Nota:* estas cifras viven en tu cuenta de Cloudflare; no se pueden incrustar
  en este informe automáticamente.

---

## 7. Estado y salud

- ✅ Worker desplegado; `/efficacy.json` devolviendo conversión real por fase.
- ✅ Eliminatorias se grafican solo cuando la ronda se completa (sin datos
  inventados).
- ✅ Reglas verificadas contra el reglamento oficial FIFA 26.
- ⏳ A medida que avancen las rondas, aparecerán automáticamente: barras de
  goleo por ronda, eficacia por fase (16vos → final) y el comparativo
  acumulado.

### Posibles siguientes pasos
- Incrustar un resumen de tráfico (si se desea, vía API de Cloudflare).
- Eficacia por fase también en versión “acumulada” (se activa sola con ≥2 fases).
- Más granularidad de tiros (xG) si ESPN lo expone por evento.
