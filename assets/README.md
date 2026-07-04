# assets/

## `wc26-logo.png` — copa/logo del centro del bracket

El bracket ("camino a la final") muestra en el centro la imagen
**`assets/wc26-logo.png`** si existe; si no, usa un SVG de la copa como respaldo.

Para usar el logo oficial:

1. Guarda el PNG en esta carpeta con el nombre exacto **`wc26-logo.png`**.
   - Ideal: **fondo transparente** (así se ve bien en tema claro y oscuro).
   - Tamaño recomendado: ~240–400 px de alto; se escala solo.
2. Súbelo al repo:
   ```bash
   git add assets/wc26-logo.png
   git commit -m "Añade logo de la copa para el bracket"
   git push
   ```
3. Listo — aparecerá automáticamente al centro del bracket (sin cambios de código).

> El código lo referencia en `js/render.js` (`renderBracket`) vía
> `<img src="./assets/wc26-logo.png" onerror="…SVG de respaldo…">`.
