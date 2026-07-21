# El modelo predictivo — historia y aprendizajes (Mundial 2026)

Una retrospectiva honesta de cómo funcionó nuestro modelo a lo largo del torneo,
y qué cambiaríamos para la próxima edición. Todas las cifras salen de la
**validación walk-forward** sobre los 104 partidos ya jugados (sin mirar el
futuro): cada partido se predijo usando **solo** los datos disponibles antes de
su pitido inicial.

## Qué es el modelo

Un predictor **transparente y resistente al sobreajuste**, no una caja negra:

- **Goles Poisson independientes** con corrección **Dixon–Coles** para marcadores
  bajos (ajusta empates y 1-0 / 0-1, que el Poisson puro subestima).
- Cada selección tiene una **calificación de ataque y una de defensa** que mezclan
  dos fuentes:
  1. un **prior pre-torneo** derivado de un Elo aproximado del fútbol mundial
     ("datos pasados", mantiene cuerdas las primeras jornadas), y
  2. la **forma dentro del torneo** (goles a favor/en contra), con **ponderación
     por recencia** (vida media de 14 días).
- **Encogimiento (shrinkage):** con `k = 5` "partidos" de prior, cuando solo hay
  1–3 juegos reales el prior domina y el modelo **no puede sobreajustarse** al ruido.
- **Ventaja local** (×1.12) para los anfitriones en fase de grupos.
- **Eliminatorias sin empate:** la probabilidad se reparte entre prórroga y penales,
  usando una fuerza de tanda por selección (proxy a nivel de plantilla).
- **Parámetros fijos**, nunca ajustados al back-test → evitamos engañarnos con
  números "de laboratorio".

## Cómo le fue (datos reales, walk-forward)

| Métrica | Valor | Referencia |
|---|---|---|
| Partidos evaluados | **104** | todo el torneo |
| Acierto 1X2 (local/empate/visitante) | **68.0 %** | azar ≈ 33 %, "siempre local" ≈ 40-45 % |
| Marcador exacto | **9.0 %** | muy difícil; ~8-10 % es bueno |
| RPS (Ranked Probability Score) | **0.15** | baseline uniforme 0.24 (menor es mejor) |
| Brier score | **0.48** | — |
| Log-loss | **0.82** | — |
| Confianza final | **moderada-alta** | sube conforme avanza el torneo |

**Lectura:** acertar **2 de cada 3** resultados en un Mundial de 48 selecciones
—con muchas sorpresas y partidos de eliminatoria a un solo tiro— es un resultado
sólido. El RPS de 0.15 frente a 0.24 del baseline dice que las **probabilidades**
(no solo el ganador) estaban bien calibradas: el modelo repartía la incertidumbre
de forma útil, no solo apostaba al favorito.

> La sección "Pronóstico vs. resultado real" del sitio muestra **los 104 partidos**,
> cada uno con la predicción que el modelo habría hecho al inicio y el resultado
> que ocurrió. Sin trampa: nada de mirar hacia adelante.

## Qué salió bien

- El **prior Elo** evitó ridículos en la jornada 1 (cuando aún no hay forma).
- El **encogimiento** hizo que el modelo no se volviera loco tras una goleada aislada.
- La **corrección Dixon–Coles** capturó bien los partidos cerrados de eliminatoria
  (muchos 1-0, como varios de la campaña del campeón).

## Qué cambiaríamos para la próxima edición

Ideas concretas, ordenadas por impacto esperado:

1. **Actualizar el prior Elo.** Las calificaciones de 2026 envejecen; hay que
   recargarlas con los ratings vigentes antes del próximo Mundial. Es el cambio de
   mayor impacto y el más barato.
2. **Penales a nivel de jugador.** Hoy usamos una fuerza de tanda por *selección*;
   con datos de cobradores individuales (y quién está en cancha en el minuto 120)
   las eliminatorias mejorarían.
3. **Disponibilidad de plantilla.** Lesiones y suspensiones no se modelan. Una capa
   de "jugadores clave disponibles" ajustaría la fuerza real de cada equipo.
4. **Ratings basados en xG, no solo en goles.** Este año empezamos a capturar
   **tiros a puerta y faltas** vía el Worker. Con más historial, un ataque/defensa
   basado en *goles esperados* es menos ruidoso que uno basado en goles.
5. **Ventaja local más fina.** Hoy es un multiplicador plano para anfitriones.
   Podría afinarse por **viaje, altitud y clima** (relevante con sedes tan dispersas
   en Norteamérica).
6. **Re-estimar `rho` (Dixon–Coles) y la vida media de forma** con datos de varios
   torneos — con cuidado de **no** ajustar al back-test de una sola edición
   (ahí es donde nace el sobreajuste).
7. **Dinámica dentro del partido** (rojas tempranas, expulsiones) como señal para
   marcadores en vivo.

## Nota metodológica

- **Walk-forward** = validación honesta: el partido *i* se predice con un modelo
  entrenado solo con los partidos `0…i-1`. Cero fuga de información del futuro.
- Comparamos siempre contra **baselines** (uniforme 1/3, "siempre local") para no
  auto-engañarnos con métricas dentro de muestra.
- **No es consejo de apuestas.** Es un ejercicio de ciencia de datos deportiva.
