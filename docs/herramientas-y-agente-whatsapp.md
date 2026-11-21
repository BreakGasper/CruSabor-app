# Crustore: herramientas y configuración del agente de WhatsApp

> Este documento está en un repositorio **público**. Por eso aquí no hay claves, tokens ni identificadores de la cuenta de Meta: solo los **nombres** de las variables y dónde se obtiene cada valor. Los valores reales viven en Render, GitHub y Meta.

Última actualización: 21 de noviembre de 2026.

---

## Parte 1. Herramientas que usa la aplicación

### Aplicación (lo que ve el usuario)

| Área | Herramienta | Para qué |
| --- | --- | --- |
| Interfaz | Vue 3 (script setup), Vue Router, Pinia, PrimeVue, SweetAlert2 | Pantallas, rutas, estado y diálogos |
| Estilos | Tailwind CSS 4 | Diseño adaptable a móvil, tablet y escritorio |
| Iconos | FontAwesome, Lucide, Heroicons | Iconos |
| Formularios | vee-validate + yup | Validación |
| Lenguaje y build | TypeScript, Vite 7 | Compilación y servidor de desarrollo |
| Datos locales | Dexie (IndexedDB) | Carrito y favoritos en el navegador |
| Lectura de códigos | @zxing/library, html5-qrcode, qrcode | Escanear y generar códigos |

### Datos y servicios en la nube

| Servicio | Para qué |
| --- | --- |
| **Firebase Realtime Database** | Usuarios, tiendas, artículos, categorías, pedidos, membresías, configuración |
| **Firebase Hosting** | Publica la app: https://mrapp-b8d1e.web.app |
| **Firebase Functions** (`functions/`) | Revisión diaria de membresías. Escrita, pero **no desplegada** (pide plan Blaze) |
| **Cloudinary** | Imágenes de artículos y tiendas (subida sin firma con un *upload preset*) |
| **Mercado Pago** | Cobro de membresías de tiendas (Checkout Pro y webhook firmado) |
| **Brevo / SMTP** | Correos de servicio, como la recuperación de contraseña |
| **Render** | Hospeda el servidor Express (`src/services/main.ts`): https://mavi-api.onrender.com |
| **GitHub Actions** | Publica la app en Firebase Hosting al unir a `main` |
| **Workload Identity Federation (Google Cloud)** | Deja que GitHub publique en Firebase **sin llaves de cuenta de servicio** |

### Servidor (Express, en Render)

| Ruta | Función |
| --- | --- |
| `/recuperar-password` | Código de recuperación generado y verificado en el servidor |
| `/pagos` | Crear pagos de membresía y recibir el webhook de Mercado Pago |
| `/imagenes` | Borrar de Cloudinary las imágenes reemplazadas |
| `/whatsapp` | **Agente de WhatsApp** (esta guía) |

Librerías del servidor: Express 5, cors, dotenv, bcryptjs, nodemailer, firebase-admin.

### Agente de WhatsApp (lo nuevo)

| Pieza | Herramienta |
| --- | --- |
| Canal de chat | **WhatsApp Cloud API de Meta** (webhook + envío) |
| Inteligencia artificial | **Google Gemini** (nivel gratuito), llamado con `fetch`, sin SDK |
| Almacenamiento | Reutiliza Firebase Realtime Database y Cloudinary de la app |
| Sesiones | Conversación en memoria del servidor; el login del día se guarda firmado en la base (`whatsappSesiones/`). No se guarda el historial del chat |

> `@anthropic-ai/sdk` está instalado en `package.json`, pero el agente **no lo usa**: el "cerebro" es Gemini, que tiene nivel gratuito.

### Calidad

Vitest + jsdom + fake-indexeddb + Vue Test Utils, y `vue-tsc` para tipos. Pruebas del agente: `tests/asistente.spec.ts`.

---

## Parte 2. Configuración que hicimos para conectar el agente

### 2.1 Qué hace el agente

Lo primero que pregunta es **¿cliente o tienda?** (botones). *menú* vuelve a preguntar.

- **Cliente (solo consulta):** artículos, precios, existencias, colores y tamaños; y de cada tienda su horario (y si está abierta ahora), dirección, teléfono, correo, redes, formas de pago, envío y preguntas frecuentes. No puede cambiar nada.
- **Tienda (administra solo la suya):** escribe *entrar*, el agente comprueba que el celular de WhatsApp sea el de una tienda y pide su contraseña. **La sesión dura hasta el fin del día (hora de México)**; al día siguiente hay que entrar otra vez. Puede:
  - publicar artículos con una foto (nombre, precio y detalles en el mismo mensaje), con resumen y confirmación,
  - ver los datos de su tienda (*mi tienda*),
  - cambiar su perfil en lenguaje natural (horario, formas de pago, envío, dirección, redes, descripción…) y su logo o portada con una foto que diga *logo* o *portada*. Todo cambio se muestra y se confirma antes de guardarse.
  - No se cambian por chat: nombre de la tienda, celular, contraseña, categoría, estado ni membresía.
- Seguridad: 5 contraseñas malas bloquean el número 15 minutos, límite de 20 mensajes cada 10 minutos por número, la tienda sobre la que se escribe sale siempre de la sesión, la sesión guardada va firmada y la IA no tiene acceso a la base de datos.

Código: `src/services/asistente/` (agente, reglas, Gemini) y `src/services/whatsapp/` (canal de Meta y webhook).

### 2.2 Despliegue automático de la app (una sola vez)

1. **Google Cloud (Cloud Shell):** activar los servicios, crear el *pool* y el *proveedor* de Workload Identity para el repositorio, crear la cuenta `github-deployer` y darle `roles/firebasehosting.admin` y `roles/serviceusage.serviceUsageConsumer`.
2. **GitHub › Settings › Secrets and variables › Actions › Variables › Repository variables:** crear `GCP_WIF_PROVIDER` y `GCP_SERVICE_ACCOUNT`. Deben ir en **Repository variables**, no en Secrets ni en Environment.
3. El flujo está en `.github/workflows/firebase-hosting.yml` y publica solo Hosting.
4. **Importante:** la configuración web de Firebase (`VITE_FIREBASE_*`) está en `.env.production`, que sí va en git (es pública por diseño). Sin ella, el build de GitHub sale en blanco con el error *"Can't determine Firebase Database URL"*.

### 2.3 Gemini (cerebro gratuito)

1. Crear una llave en https://aistudio.google.com/apikey (sin tarjeta).
2. En Render: `GEMINI_API_KEY`.
3. Modelo por defecto: `gemini-3.8-flash`. Se puede cambiar **sin tocar el código** con la variable opcional `GEMINI_MODEL`.
4. El agente reintenta solo, hasta 2 veces, si Google responde 429 o 5xx (por ejemplo 503 por alta demanda) y 1 vez si no responde en 30 s. Si el modelo sigue saturado o ya no existe, prueba solo otro modelo Flash que Google ofrezca (o los de `GEMINI_FALLBACK_MODEL`, opcional, separados por coma). Si es cuota agotada (429) pasa directo a otro modelo. Si aun así falla, a los clientes les responde con una lista simple sin IA (tiendas, artículos, horario…) y a las tiendas les avisa y, si mandó una foto, puede escribir *reintentar* para repetir con la misma foto.

> Aviso: en el nivel gratuito, Google puede usar las fotos y textos enviados para mejorar sus productos.

### 2.4 Meta (WhatsApp Cloud API)

1. https://developers.facebook.com/apps → **Crear app** con el caso de uso *Conectar con los clientes a través de WhatsApp*. Elegir o crear un portafolio comercial (**no hace falta verificarlo**).
2. En el caso de uso, **Paso 1. Probar** entrega un número de prueba, su *Phone Number ID* y el token temporal. Agregar tu celular como **destinatario** y confirmarlo con el código que llega por WhatsApp.
3. **Configurar el webhook:**
   - URL de devolución de llamada: `https://mavi-api.onrender.com/whatsapp/webhook`
   - Identificador de verificación: el **valor** de `WHATSAPP_VERIFY_TOKEN` (no el nombre de la variable).
   - Suscribirse al campo **`messages`** y asegurarse de que el interruptor **Suscribirse a webhooks** de la cuenta de WhatsApp Business esté encendido.
4. **Política de privacidad pública** (requisito para publicar la app): `https://mrapp-b8d1e.web.app/privacidad.html` (archivo `public/privacidad.html`). La sección de borrado de datos es `#eliminar-datos`.
5. **Configuración de la aplicación › Básica:** pegar la URL de la política, el icono y la categoría.
6. **Testear casos de uso:** hacer en el *Explorador de la API Graph* una llamada `me?fields=id,name` (`public_profile`) y otra `{ID-de-la-cuenta}/phone_numbers` (`whatsapp_business_management`) para que Meta marque los requisitos como completados.
7. **Publicar la app** (modo *Activo*). Mientras esté sin publicar, Meta solo muestra los mensajes reales en su panel de pruebas y **no se los entrega al servidor**.
8. En el **Administrador de WhatsApp** quedó una cuenta con su número de producción asignado por Meta. Ese es el número al que se escribe y de donde sale el *Phone Number ID* de Render.
9. El aviso naranja *"Falta un método de pago válido"* **no hace falta atenderlo**: el agente solo responde a quien le escribe primero (conversaciones gratuitas). El pago solo se necesitaría para escribirle primero a alguien.

### 2.5 Variables en Render (servicio `mavi-api` › Environment)

| Variable | De dónde sale |
| --- | --- |
| `API_PUBLIC_URL` | La URL del servicio en Render |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` (opcional) | Nombre del modelo, si Google retira el actual |
| `GEMINI_FALLBACK_MODEL` (opcional) | Modelo(s) de respaldo, separados por coma; si no se define, se eligen solos |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta › identificador del **número de teléfono** (no el de la cuenta, no el celular) |
| `WHATSAPP_TOKEN` | Token de acceso; ver 2.6 |
| `WHATSAPP_VERIFY_TOKEN` | Texto que tú inventas; debe ser idéntico en Meta |
| `WHATSAPP_APP_SECRET` | Meta › Configuración de la aplicación › Básica › Clave secreta (también firma la sesión del día guardada) |

Al guardar, Render se reinicia solo (1 a 2 minutos). `GET https://mavi-api.onrender.com/whatsapp/estado` dice `"activo":true` o qué variable falta.

### 2.6 Token permanente (para que no caduque)

El token que da Meta en *Paso 1. Probar* dura unas 24 horas. Para uno permanente:

1. https://business.facebook.com/settings › **Usuarios › Usuarios del sistema › Añadir** (nombre `crustore-agente`, rol *Administrador*).
2. **Asignar activos:** la app (control total) y la cuenta de WhatsApp (control total).
3. **Generar token:** elegir la app, caducidad **Nunca** (o 60 días si no aparece) y los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Copiarlo **en ese momento** (se muestra una sola vez) y pegarlo en Render como `WHATSAPP_TOKEN`.

### 2.7 Cómo probar

1. Desde un celular agregado como destinatario, escribir **hola** al número de WhatsApp: debe responder el menú.
2. Escribir **¿tienen pasteles?**: responde con el catálogo (usa Gemini).
3. Escribir **entrar** (desde el celular que está registrado en la tienda) y la contraseña; borrar ese mensaje del chat.
4. Enviar una **foto** con el nombre y el precio en el mismo mensaje: aparece el resumen con **Publicar / Descartar**.

---

## Parte 3. Problemas que tuvimos y su solución

| Síntoma | Causa | Solución |
| --- | --- | --- |
| La app publicada salía en blanco: *Can't determine Firebase Database URL* | El build de GitHub no tenía las variables `VITE_FIREBASE_*` (estaban solo en el `.env` local) | Ponerlas en `.env.production`, que sí va en git |
| `google-github-actions/auth` fallaba en GitHub | Faltaban `GCP_WIF_PROVIDER` y `GCP_SERVICE_ACCOUNT` en *Repository variables* | Crearlas con los valores completos |
| Facebook: *dispositivo que no usas habitualmente* o *cuenta demasiado nueva* | Protección de seguridad de Meta | Usar el dispositivo y la red de siempre y esperar; no se puede saltar |
| Meta no validaba el webhook | En *Identificador de verificación* se escribió el **nombre** de la variable | Escribir su **valor** |
| `/whatsapp/estado` decía `"activo": false` | Faltaban variables en Render | Agregar las que liste `faltan` |
| El "hola" real no llegaba al servidor | App sin publicar y/o la cuenta de WhatsApp sin suscribirse a webhooks | Encender *Suscribirse a webhooks*, completar los requisitos de prueba y publicar |
| `Gemini 404: models/gemini-2.5-flash is no longer available` | Google retiró ese modelo para cuentas nuevas | Modelo `gemini-3.8-flash` (o `GEMINI_MODEL`) |
| `Gemini 429 … exceeded your current quota` | Se agotó la cuota gratuita **por minuto** (RPM; Gemini 3.8 Flash gratis permite solo 5 por minuto y cada modelo tiene la suya) | El agente aparta ese modelo el tiempo que Google pida (o 60 s), usa otro mientras tanto y, si todos están agotados y falta poco, espera y reintenta; para clientes responde con una lista simple sin IA. Ver límites por modelo en https://aistudio.google.com/rate-limit (botón *Todos los modelos*) y poner en `GEMINI_MODEL` el que tenga más RPM |
| `Gemini 503: high demand` o `Gemini: sin respuesta en 30 s` | Pico de demanda de Google | Pasajero; el agente reintenta, prueba otro modelo Flash y, si no, pide escribir *reintentar* |
| `WhatsApp envío 401 … code 190` | Token temporal vencido | Generar uno nuevo o crear el token permanente (2.6) |
| `131037 … needs display name approval` | El número emisor (el que da WhatsApp) aún no tiene aprobado su nombre visible | Enviar el nombre en Administrador de WhatsApp › número › Perfil › Nombre para mostrar y esperar la aprobación; mientras, usar el número de prueba |
| `131030 Recipient phone number not in allowed list` | Con el número de prueba, el celular no está en la lista de destinatarios (o México: `521…` vs `52…`) | Agregar y verificar el celular en *Paso 1. Probar › Destinatario*; el agente ya reintenta con el otro formato del número |
| Respuestas que no salen del número nuevo | `WHATSAPP_PHONE_NUMBER_ID` apuntaba a otro número | Usar el identificador del número con el que se chatea |

---

## Parte 4. Pendientes y límites

- Si Render se duerme o reinicia se pierde la conversación en curso (por ejemplo, un artículo a medio confirmar), pero **no** el login del día. En el plan gratuito, la primera respuesta tras inactividad puede tardar cerca de un minuto.
- Los límites gratuitos de Gemini son diarios.
- Para usar **tu número real de negocio** se añade en el Administrador de WhatsApp (*Añadir número de teléfono*) y se verifica por SMS o llamada; ese número no puede estar activo en la app normal de WhatsApp sin migrarlo. Después hay que cambiar `WHATSAPP_PHONE_NUMBER_ID`.
- No se implementó consultar el estado de un pedido por WhatsApp, ni editar, pausar o dar de baja artículos ya publicados.
- Al cambiar el logo o la portada se borra la imagen anterior de Cloudinary solo si están configuradas `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en Render; si no, queda huérfana.
