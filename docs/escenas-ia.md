# Escenas de fondo con IA (Crear publicación)

La tienda sube la foto de su producto; la app le **quita el fondo** (en el teléfono) y una IA **inventa solo el fondo** a partir
de un estilo o de un texto. El producto se pega encima tal cual es, así que nunca sale distinto del real.

Es gratis mientras se respete la cuota diaria de **Cloudflare Workers AI** (modelo FLUX.1 schnell). Sin configurar, el botón
no aparece y todo lo demás sigue funcionando.

## Activarlo (una sola vez)

1. Crea una cuenta gratuita en Cloudflare y copia tu **Account ID** (panel › Workers & Pages › columna derecha).
2. En *My Profile › API Tokens* crea un token con el permiso **Workers AI** (lectura y ejecución). Cópialo al momento: no se vuelve a mostrar.
3. En Render, servicio `mavi-api` › Environment, agrega:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
   - (opcional) `ESCENAS_MAX_DIA` — tope diario de imágenes en todo el servidor (300 por defecto)
   - (opcional) `ESCENAS_MAX_HORA_IP` — tope por hora y por persona (8 por defecto)
4. Redespliega el servicio. En el registro del servidor debe aparecer «escenas con IA activas».

Nunca pegues el token en el código, en el repositorio ni en un chat: solo en las variables de entorno de Render.

## Cómo funciona

- `POST /escenas/generar { descripcion }` → `{ imagen }` (data URL). `GET /escenas/estado` → `{ activo, restantesHoy }`.
- El servidor completa el texto con reglas fijas (sin gente, sin letras, espacio libre al centro).
- Topes por persona y por día para no agotar la cuota; si la IA falla no se gasta el cupo.
- Código: `src/services/escenas/`, `src/modules/store/utils/{escenas,quitarFondo,dibujarPublicacion}.ts`.
