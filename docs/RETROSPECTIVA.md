# Retrospectiva — Mundial 2026 (torneo concluido)

Este documento cierra el proyecto: registra el resultado final, las fuentes de los
datos del hub retrospectivo, y cómo quedó archivado el sitio.

## El campeón

**España** se coronó campeona del mundo por **segunda vez**, venciendo a
**Argentina 1-0** en la prórroga. Gol de **Ferran Torres al minuto 106**. Final
disputada en East Rutherford (Nueva York/Nueva Jersey). España terminó el torneo
**invicta** (7 victorias y 1 empate).

- Bota de Oro: **Kylian Mbappé** (Francia) — 10 goles, por delante de Messi (8).
- Balón de Oro (mejor jugador): **Rodri** (España).
- Guante de Oro (mejor portero): **Unai Simón** (España) — 1 gol recibido en todo el torneo.
- Mejor Jugador Joven: **Pau Cubarsí** (España), 19 años.
- España barrió **3 de los 4** premios individuales.

## El torneo en cifras (datos congelados)

- **104 partidos**, **308 goles**, promedio **2.96 por partido**.
- Mayor goleada: **Canadá 6-0 Qatar**.
- El partidazo: **Francia 4-6 Inglaterra** (partido por el tercer lugar).

## Fuentes

Los resultados de los 104 partidos provienen del proyecto de dominio público
**openfootball** (`openfootball/worldcup.json`, edición 2026), que es la fuente
base del sitio durante todo el torneo. Los premios individuales y el relato de la
final se corroboraron con cobertura periodística:

- NPR — *Spain is the 2026 World Cup champion, defeating Argentina for its 2nd title*.
- ESPN — *Spain 1-0 Argentina (AET): Ferran Torres wins second World Cup for La Roja*.
- FIFA — *Spain 1-0 Argentina | World Cup 2026 report and highlights*.
- Al Jazeera / NBC Sports / Olympics.com — *2026 World Cup award winners: Golden Boot,
  Golden Ball, Best Young Player, Golden Glove*.

## Cómo quedó archivado el proyecto

El Mundial terminó y los datos ya no cambian, así que el sitio pasó a **modo archivo**
(`CONFIG.ARCHIVED = true` en `js/config.js`):

- **Cero llamadas de red de datos.** No se consulta openfootball, ni el Worker, ni
  ninguna API en vivo; el sitio lee solo los archivos congelados en `./data/`.
- Los **resultados finales** quedaron congelados en `data/worldcup.json` (y una
  copia en `data/archive/wc2026-results.json`).
- Los botones de "suscribirse al calendario" (que prometían actualizaciones futuras)
  se ocultan; queda la descarga estática `.ics` como recuerdo.

### Congelar también los datos capturados por el Worker (opcional)

El Worker acumuló un dataset propio (faltas, tiros a puerta, tarjetas, eficacia real
por fase y minutos agregados medidos del reloj de ESPN) que **solo vive en su KV**.
Para conservarlo en el repo antes de retirar el Worker:

```bash
bash worker/snapshot-archive.sh     # descarga /teamstats, /efficacy.json, /snapshot a data/archive/
```

Luego puedes **apagar el cron** del Worker (deja de gastar cuota de KV):

```bash
cd worker && npx wrangler triggers deploy --triggers ''
# o eliminar el Worker por completo desde el panel de Cloudflare
```

Este dataset es la **semilla para la próxima edición**: el prior del modelo, las
tablas de penales y la estructura de captura ya están listos para reutilizarse.
