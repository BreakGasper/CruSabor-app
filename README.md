# 🛍️ CruSabor App (MAVI Store)

Marketplace web con tres caras: la **tienda en línea** para clientes, el **panel de tiendas** para negocios que publican productos y atienden pedidos, y el **panel de administración** de la plataforma.

Construida con **Vue 3 + TypeScript + Vite**, **Firebase Realtime Database** como backend, **Dexie (IndexedDB)** para carrito y favoritos en el navegador, y un pequeño **servidor Express** (correo y pagos con Mercado Pago). Diseño adaptable a móvil, tablet y escritorio, con tema claro y oscuro.

> **Cómo leer este documento.** Las secciones 1 a 3 sirven para arrancar el proyecto. La sección 4 explica dónde vive cada cosa y las convenciones de código. Las secciones 5 a 9 son las **reglas de negocio**, agrupadas por tema (tiendas, artículos, carrito, pedidos, membresías, administración): ahí está el "por qué" de cada comportamiento. La 10 describe las pruebas, la 11 los scripts de mantenimiento, la 12 los pendientes y la 13 la bitácora de decisiones tomadas.

---

## Índice

1. [Stack y URLs](#1-stack-y-urls)
2. [Puesta en marcha](#2-puesta-en-marcha)
3. [Despliegue](#3-despliegue)
4. [Mapa del código y convenciones](#4-mapa-del-código-y-convenciones)
5. [Rutas](#5-rutas)
6. [Tiendas](#6-tiendas)
7. [Artículos](#7-artículos)
8. [Carrito, checkout y pedidos](#8-carrito-checkout-y-pedidos)
9. [Membresías y pago con Mercado Pago](#9-membresías-y-pago-con-mercado-pago)
10. [Administración](#10-administración)
11. [Pruebas](#11-pruebas)
12. [Scripts de mantenimiento](#12-scripts-de-mantenimiento)
13. [Pendientes conocidos](#13-pendientes-conocidos)
14. [Bitácora de decisiones](#14-bitácora-de-decisiones)

---

## 1. Stack y URLs

| Área | Herramienta |
| --- | --- |
| UI | [Vue 3](https://vuejs.org/) (script setup), [Vue Router](https://router.vuejs.org/), [Pinia](https://pinia.vuejs.org/), [PrimeVue](https://primevue.org/), [SweetAlert2](https://sweetalert2.github.io/) |
| Iconos | [FontAwesome](https://fontawesome.com/) y [Lucide](https://lucide.dev/) |
| Datos | [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) (usuarios, tiendas, artículos, categorías, pedidos, configuración, admins, calificaciones) |
| Local | [Dexie](https://dexie.org/) sobre IndexedDB (carrito, favoritos, tiendas favoritas), respaldado por usuario en Firebase (`src/db/sync.ts`) |
| Imágenes | Cloudinary / Firebase Storage |
| Servidor | Express (`src/services/main.ts`): recuperar contraseña (código en el servidor; correo por SMTP en local y por API de Brevo en producción) y pagos de membresía con Mercado Pago. Publicado en Render (`render.yaml`) |
| Pagos | [Mercado Pago Checkout Pro](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/landing) vía API REST con `fetch` (sin SDK), webhook firmado |
| Calidad | [vue-tsc](https://github.com/vuejs/language-tools), [Vitest](https://vitest.dev/) + jsdom + fake-indexeddb + Vue Test Utils |
| Hosting | App: Firebase Hosting (`dist`) → https://mrapp-b8d1e.web.app · API: Render → https://mavi-api.onrender.com |

Proyecto de Firebase: `mrapp-b8d1e`. Base: `https://mrapp-b8d1e-default-rtdb.firebaseio.com`.

---

## 2. Puesta en marcha

```bash
git clone https://github.com/BreakGasper/CruSabor-app.git
cd CruSabor-app
npm install
```

### Variables de entorno

`.env` (valores generales; no subir al repositorio):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# Servidor de correo (recuperar contraseña)
SMTP_USER=
SMTP_PASS=
PORT=3000
FRONTEND_URL=http://localhost:5173
```

`.env.local` (secretos; lo ignora git, tiene prioridad sobre `.env`; lo leen Vite y el servidor):

```env
MP_ACCESS_TOKEN=TEST-...            # Access Token de Mercado Pago (TEST- pruebas / APP_USR- producción)
MP_WEBHOOK_SECRET=                  # clave del webhook (Mercado Pago › Tus integraciones › Webhooks)
API_PUBLIC_URL=https://mavi-api.onrender.com   # URL pública https del servidor Express
FRONTEND_URL=https://mrapp-b8d1e.web.app
FIREBASE_SERVICE_ACCOUNT_JSON=      # opcional: cuenta de servicio en una línea (firebase-admin)
VITE_API_URL=http://localhost:3000  # a dónde llama la app; al compilar para producción debe ser la URL de Render
```

`render.env.local` tiene el mismo contenido preparado para pegarse en Render › Environment › "Add from .env".

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con Vite |
| `npm run build` | Compila a `dist/` (la carpeta está versionada: Firebase Hosting la sirve) |
| `npm run preview` | Sirve el build localmente |
| `npm run type-check` | Revisa tipos en `.ts` y `.vue` con vue-tsc |
| `npm test` | Corre la suite de Vitest una vez |
| `npm run test:watch` | Vitest en modo interactivo |
| `npm run server` | Servidor Express local en el puerto 3000 (correo + pagos) |

Antes de dar por terminado un cambio: `npm test` y `npm run type-check` deben pasar.

---

## 3. Despliegue

- **App**: `npm run build` (con `VITE_API_URL` apuntando a Render) y luego `firebase deploy --only hosting`. Sin esto, los cambios no se ven en el teléfono.
- **Servidor**: Render hace `autoDeploy` con cada push a `main` (blueprint en `render.yaml`, health check `GET /salud`). Es plan gratuito: se duerme tras inactividad y la primera petición puede tardar ~1 minuto.
- **Función programada** `revisarMembresias` (carpeta `functions/`, Firebase Functions v2): está escrita para correr a diario a las 06:00 hora de Ciudad de México (bloquea tiendas vencidas, envía recordatorios y deja su resumen en `configuracion/ultimaRevisionMembresias`), pero **no está desplegada**: requiere plan Blaze y el proyecto está en Spark. Mientras tanto la misma lógica se corre a mano con `node scripts/revisar-membresias.mjs` (o con el Programador de tareas de Windows).

---

## 4. Mapa del código y convenciones

```
src/
├── components/          Compartidos: PageHeader (barra azul sticky), TopBarFija (píldora fija con regreso),
│                        ArrowBack, ConfirmModal, CustomToast, CartButton, StarRating, PullToRefresh, DireccionForm,
│                        BotonCompartir (menú del sistema o lista con WhatsApp / Facebook / correo / copiar)
├── composables/         Acceso a Firebase y reglas puras:
│                        useAuth, useTiendas, useArticulos, useCategorias, usePedidos, useMembresia,
│                        useHorarioTienda, useCalificaciones, useAlertasTienda, useEnvioTienda,
│                        useMercadoPago, useSolicitudesPago, useConfiguracion, useDirecciones,
│                        useAdmin, useAdminTiendas, useAdminCategorias
├── db/                  Dexie: esquema (Carrito, Favoritos, TiendasFavoritas), sync con Firebase y composables locales
│   └── composables/     useCarrito, useCarritoRapido, useFavoritos, useTiendasFavoritas
├── modules/
│   ├── home/            Flujo del cliente (Home, catálogo, carrito, checkout, pedidos, perfil, login/registro)
│   ├── store/           Flujo de la tienda (perfil, productos, pedidos, campana de avisos, login/registro)
│   └── admin/           Panel del administrador (tablero, tiendas, categorías, configuración, cuentas)
├── plugins/             Registro de iconos FontAwesome
├── services/            Servidor Express: main.ts (correo) y pagos/ (Mercado Pago: router, logicaPago, mercadoPagoApi, almacen)
├── utils/               sessionUser, sessionAdmin, sessionPedido, utilidades
├── types/               Producto
├── style.css            Base: tipografía, tokens en :root, campos de formulario con color del tema
└── assets/styles/ColorsVarCss.css   Tokens de color (claro/oscuro)
tests/                   Vitest: mocks de Firebase y router, pruebas de reglas y de componentes
scripts/                 Utilidades de mantenimiento sobre la base (ver sección 12)
functions/               Firebase Functions (revisión diaria de membresías)
```

### Patrón "mapa compartido en vivo"

Varios composables suscriben **una sola vez** un nodo completo de Firebase y lo comparten entre pantallas mediante un `ref` de módulo: `useEstadoTiendas` (estatus, membresía y **nombre** de cada tienda), `useEnvioTienda` (envío a domicilio), `useHorarioTiendas` (horario), `useCalificaciones` (votos). Todos exponen un `__set…` para fijar el mapa en pruebas sin Firebase. Úsalo antes de hacer `get` sueltos por pantalla.

### Sesiones

Tres sesiones distintas en `localStorage`: `usuario` (cliente, `sessionUser`), `tiendas` (tienda) y `admin` (administrador, `sessionAdmin`). Iniciar una cierra las otras: solo hay una activa a la vez.

### Tema claro y oscuro

La app sigue la preferencia del sistema (`color-scheme: light dark`). Los colores viven en `src/assets/styles/ColorsVarCss.css` como tokens con variante clara y oscura: `--bg-page`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--border`, y para texto en color de marca `--brand-navy-text` / `--brand-blue-text`. **Regla**: no usar `white`, `#fff`, `#333`, `#666`, `#ccc`… para fondos, texto o bordes; usar los tokens. Los badges de estado (fondo pastel + texto oscuro fijados juntos) sí pueden llevar colores fijos porque se leen en ambos modos. `src/style.css` da a inputs, selects y textareas el fondo y color del tema para que el navegador no los pinte oscuros con texto invisible. `index.html` lleva dos `theme-color` (claro/oscuro).

### Cabeceras fijas

Título y botón de regresar nunca se pierden al hacer scroll:

- `PageHeader` (barra azul de listas y detalles) es `sticky` por defecto; `:sticky="false"` lo desactiva.
- Las pantallas con cabecera grande tipo portada (login, registro, checkout, formulario de producto, perfil de usuario) usan `TopBarFija.vue`: píldora fija arriba a la izquierda con la flecha y el título.
- En el detalle de producto y en el perfil de tienda (visitante) los botones flotantes son `position: fixed`.
- El perfil **propio** de la tienda es la única pantalla sin botón de regresar: la dueña o dueño entra ahí como pantalla principal.

### Deslizar para actualizar (móvil)

`PullToRefresh.vue` envuelve el `router-view` en `App.vue`. El gesto **solo empieza desde la cabecera** de la pantalla; si además la página y el contenedor bajo el dedo están arriba del todo y se arrastra hacia abajo más de 70 px, emite `refresh`; `App.vue` incrementa la `key` del `router-view`, la vista se desmonta y vuelve a montar y repite sus cargas de `onMounted`. No recarga la página ni toca sesión o carrito local. Existe porque `overscroll-behavior: contain` desactiva el gesto nativo y en modo PWA no hay botón de recargar.

Las zonas válidas están en `SELECTOR_CABECERA` (`PullToRefresh.vue`): `.page-header`, `.top-bar-fija`, `.top-bar-top` (portada), `.admin-topbar`, `.store-banner` (perfil de tienda), `.detalle-header` (detalle de producto) y cualquier elemento marcado con `data-pull-refresh`. Empezar el arrastre fuera de esas zonas no arma el gesto, así que `onMove` nunca llama a `preventDefault` y el contenido se desplaza sin estorbos. **Si agregas una pantalla con una cabecera propia, añade su clase a esa lista o márcala con `data-pull-refresh`**, si no esa pantalla se queda sin el gesto.

### Nombres y zona horaria

- Fechas de negocio en ISO (`fecha_creacion`, `historial[].fecha`); la zona horaria de la app es `America/Mexico_City` (horarios de tienda, servidor de pagos).
- Los mensajes al usuario están en español y sin tecnicismos; los identificadores de código en español también (`estatus`, `tienda`, `pedido`).

---

## 5. Rutas

**Cliente**

| Ruta | Pantalla |
| --- | --- |
| `/` | Portada: barra superior fija (menú · buscador · carrito · perfil), categorías, "Explorar", tiendas, productos |
| `/producto/:id` | Detalle de producto, variantes, calificación, agregar al carrito |
| `/categoria` | Categorías con buscador y conteo de productos |
| `/categoriaArticulos/:id/:nombre` | Productos de una categoría |
| `/tiendas` | Directorio de tiendas: buscador, chips de categoría y favoritas, tarjetas `TiendaCard` |
| `/cart` → `/checkout` | Carrito agrupado por tienda y confirmación en 3 pasos (domicilio, pago, resumen) |
| `/pedidos`, `/pedido/:id` | Mis pedidos y seguimiento con historial, motivo de cancelación y cancelación |
| `/favoritos`, `/perfil` | Favoritos y perfil (datos, compras, favoritos, tiendas favoritas, direcciones, configuración) |
| `/login`, `/register` | Acceso y registro de clientes (ver "Un celular, dos accesos" en la sección 10) |

**Tienda**

| Ruta | Pantalla |
| --- | --- |
| `/store/login`, `/store/register` | Acceso y registro de tiendas (asistente de 5 pasos) |
| `/store/profile/:id?` | Perfil público de la tienda; para la dueña o dueño es su pantalla principal (campana de avisos, editar, pagar membresía) |
| `/store/articles/:id` | Catálogo de la tienda; la dueña o dueño ve además pausar venta / dar de baja |
| `/store/products/:id`, `/store/product/edit/:articuloId` | Alta y edición de productos |
| `/store/pedidos/:id_tienda` | Gestión de pedidos en tiempo real (Atender, Marcar enviado, Entregado, Cancelar) |

**Administrador** (login propio sin Firebase Auth, `useAdmin.ts`; guard en `modules/admin/adminRoutes.ts`)

| Ruta | Pantalla |
| --- | --- |
| `/admin/login` | Acceso con celular y contraseña (`admins/`) |
| `/admin` | Tablero: contadores por estatus, pendientes, pagos por confirmar, última revisión de membresías |
| `/admin/tiendas`, `/admin/tiendas/:id` | Tiendas: estatus, membresías, registrar pagos manuales, historial. Arriba, interruptor para **abrir/cerrar el registro de tiendas nuevas** |
| `/admin/categorias` | Catálogo de categorías (con propagación del nombre a tiendas y artículos) |
| `/admin/configuracion` | Nodo `configuracion`: precios de membresía, días de gracia, modo de pago (`links` / `automatico`), mantenimiento, registro abierto |
| `/admin/cuentas` | Cuentas de administrador (crear/editar/activar) y **soporte a clientes**: buscar cliente y restablecer su contraseña o corregir nombre/correo |
| `/admin/banners` | Banners del carrusel de la portada: subir imagen, título/subtítulo, enlace, vigencia (fechas), activar/ocultar y ordenar |
| `/admin/municipios` | Municipios de Jalisco: cargar los 125, marcar con check cuáles tienen alcance (cobertura), marcar/desmarcar todos y eliminar; solo los de alcance se ofrecen al registrar/editar tienda |

---

## 6. Tiendas

### Estatus y membresía (`useMembresia.ts`)

- Campo de control: `tiendas/{id}/estatus` (`pendiente | activa | bloqueada`; se llama **`estatus`**, porque `estado` es el estado geográfico). El estado efectivo agrega `vencida` cuando `membresia.vigenteHasta` pasó más los `configuracion.membresia.diasGracia`.
- Una tienda **puede vender** solo si su estado efectivo es `activa`. Tiendas anteriores a la regla (sin `estatus`) se tratan como activas. Para **publicar productos** además necesita membresía vigente (`membresiaVigente`).
- El catálogo público, el carrito rápido y `guardarPedidos` bloquean tiendas que no pueden vender (`tiendasQueNoPuedenVender` → `TiendaNoDisponibleError`).

### Nombre de la tienda

Fuente de verdad: `tiendas/{id}/nombreTienda`. Artículos (`tiendaNombre`), carrito (`nombre_tienda`) y pedidos (`items[].nombreTienda`) guardan solo una copia. Al renombrar desde el perfil, `actualizarTienda` la propaga a todos sus artículos (`sincronizarNombreEnArticulos`); catálogo y carrito muestran siempre el nombre vivo vía `useEstadoTiendas().nombreDe`. Los pedidos conservan el nombre histórico a propósito. Copias viejas: `node scripts/sincronizar-nombre-tienda.mjs --apply`.

### Horario de atención (`useHorarioTienda.ts`)

`tiendas/{id}/horario` tiene una entrada por día ("Lunes"…"Domingo") con `inicio`/`fin` en `HH:MM`; día sin horas = cerrado. Los productos de una tienda **cerrada** se pueden guardar en el carrito pero no comprar: el carrito los marca, los excluye del total y manda al checkout solo los de tiendas abiertas; `guardarPedidos` vuelve a validar (`TiendaCerradaError`). Tras comprar solo salen del carrito los artículos comprados. Sin horario registrado = abierta. Se admiten horarios que cruzan la medianoche; `proximaApertura` da el texto "Abre hoy a las 10:00 a.m.".

### Compartir (`BotonCompartir.vue`, `useCompartir.ts`)

En el **perfil de tienda** es una píldora con texto (`mostrar-texto`) al cierre de la tarjeta "Otros datos", debajo del blog; queda fuera del `v-if` del blog para que aparezca aunque la tienda no lo tenga. Lo ven tanto visitantes como la dueña o dueño, porque quien más difunde su tienda es su propietario. En el teléfono abre `navigator.share`, la hoja del sistema con todas las apps instaladas (WhatsApp, Messenger, Telegram, Mensajes). Donde no existe —escritorio, o si el navegador la niega— se despliega una lista propia con WhatsApp, Facebook, correo y copiar enlace.

El mismo componente está en el **detalle de producto** (`urlProducto(articuloId)` → `/producto/:id`) como círculo flotante en la columna del borde derecho, debajo del corazón; sin corazón (visitante sin sesión o una tienda mirando) ocupa su lugar. A partir de 900 px el corazón cuelga del borde inferior de la imagen, así que ahí los dos van a la misma altura y compartir se pone a su izquierda. El mensaje del producto nombra el artículo y su tienda pero **no lleva precio**: cada variante tiene el suyo y cambia, así que el texto acabaría contradiciendo la pantalla que abre quien lo recibe.

El enlace se arma con `urlPerfilTienda(tiendaId)` / `urlProducto(articuloId)` a partir del origen y la ruta, **nunca** con `location.href`: así no se comparte por accidente la query del momento (`?pago=exito` al volver de Mercado Pago). `wa.me/?text=` sin número deja que la persona elija el contacto. La lista se teleporta a `<body>` por la misma razón que la campana: `.store-banner` tiene `overflow: hidden` y la recortaría.

**Salida de las pantallas compartidas.** Quien abre el enlace entra directo al perfil o al producto, sin historial dentro de la app: ahí `router.back()` no lleva a ningún lado (o saca de la app y regresa a WhatsApp). Por eso la flecha de esas dos pantallas usa `volverOInicio(router)` de `src/utils/navegacion.ts`, que mira `history.state.back` —lo llena Vue Router con la ruta anterior, o `null` si fue la primera— y manda a la portada con `replace` cuando no hay a dónde volver. `PageHeader` ya resolvía lo mismo por su cuenta (con su prop `fallback`); las pantallas que se saltaron la regla eran justo las dos que tienen flecha flotante propia. **Cualquier pantalla nueva que se pueda abrir por enlace debe usar una de las dos vías, nunca `router.back()` pelado.**

`BotonCompartir` tiene **un solo nodo raíz** (un `<span>` que envuelve al botón y al `Teleport`). No es cosmético: con dos raíces Vue no le pasa el `data-v-` del padre y **cualquier regla scoped del padre deja de aplicar en silencio** —posición, márgenes, centrado—. `tests/compartir.spec.ts` lo vigila comprobando que el envoltorio lleve también el scope de la pantalla que lo usa.

### Redes sociales y su enlace

`tiendas/{id}` guarda el nombre de la red (`facebook`, `instagram`) y, aparte, su enlace (`facebookUrl`, `instagramUrl`). El enlace es **opcional**: en el registro y en editar tienda aparece una casilla "Agregar enlace" y, al marcarla, el campo de la dirección. En el perfil, con enlace el nombre es un `<a target="_blank" rel="noopener noreferrer">` que abre la red en otra pestaña o en su app; sin enlace es un `<span>`, no un `<a>` muerto como antes.

**Lo que teclea la tienda acaba en un `href` que ven todos sus clientes**, así que pasa siempre por `normalizarEnlace` (`src/utils/enlaces.ts`): solo acepta `http` y `https` —un `javascript:` ahí se ejecutaría en el navegador de quien tocara el icono—, exige un dominio con punto y completa con `https://` lo que se escribe sin esquema (`facebook.com/lola`). Se normaliza **al guardar y otra vez al mostrar**: así un enlace que ya estuviera en la base tampoco puede llegar al `href`.

### Favoritas y calificación

- Tiendas favoritas por cliente en Dexie (`useTiendasFavoritas`), respaldadas en Firebase.
- **Calificaciones** (`useCalificaciones.ts`, `StarRating.vue`): `calificaciones/{articulos|tiendas}/{id}/{usuarioId} = { estrellas, fecha }`. Un voto por cliente (volver a votar lo reemplaza); promedio y total se calculan al leer (`resumirVotos`). Se califica una **tienda** solo desde su perfil (la dueña o dueño ve el promedio sin votar); en la portada y en `/tiendas` las estrellas son de lectura. Sin sesión de cliente se ofrece ir al login.

### Perfil propio y campana de avisos (`CampanaTienda.vue`, `useAlertasTienda.ts`)

La dueña o dueño ve en su perfil y en su lista de productos una campana con: **pedidos por atender** (su parte en `Preparacion`, con el tiempo que queda antes de la cancelación automática) y artículos **agotados** o **por agotarse** (`resumenStock`: alguna variante con stock ≤ `UMBRAL_STOCK_BAJO = 3`; no aplica a stock ilimitado, bajo pedido ni dados de baja). El panel se teleporta a `<body>` (hoja inferior en móvil, diálogo en escritorio) y ofrece pausar venta, dar de baja y **actualizar stock**. Este último **cierra el panel de avisos** y abre `ModalStock.vue`, que pide las piezas disponibles —un campo por variante que se cuente, con botones + / −— y escribe solo eso con `actualizarStockArticulo`, por ruta (`variantes/{i}/stock`) para no pisar lo demás del artículo. Antes mandaba al formulario completo, que es un rodeo largo para teclear un número.

El diálogo trae **cámara para contar escaneando**: cada lectura se compara con el SKU de las variantes (`indicePorCodigo`, que ignora espacios y mayúsculas pero exige el código completo) y suma **una pieza** a la que coincida; la cámara sigue encendida para contar pieza por pieza, y un código ajeno avisa sin sumar. Es un componente y no un `Swal` con html porque la cámara necesita ciclo de vida propio —se apaga al cerrar, al guardar y al desmontar— y los campos deben reaccionar a cada lectura. Las reglas puras (`variantesConStock`, `indicePorCodigo`, `normalizarStock`) se prueban solas; `normalizarStock` rechaza el campo vacío aparte, porque `Number("")` es 0 y borrar la caja habría guardado «cero piezas» en silencio.

---

## 7. Artículos

`articulos/{id}`: `nombre, descripcion, precio, categoria, categoriaId, unidadMedida, url, tiendaId, tiendaNombre, variantes[], porPedido, ventaPausada, baja, fecha_hora`. Cada variante: `sku, color, tamano, material, marca, precio, stock, tieneStock, url, detalle, isDefault`.

- **Stock**: por variante, transaccional al crear pedido y se devuelve al cancelar. `stock === -1` es ilimitado (`tieneStock: false`).
- **Bajo pedido** (`porPedido: true`, casilla del formulario): la tienda lo elabora cuando lo piden; no controla stock (carrito y detalle lo tratan como ilimitado), lleva etiqueta "Bajo pedido" y la marca viaja al carrito y a `items[].porPedido` del pedido.
- **Venta pausada** (`ventaPausada: true`): visible en el catálogo con etiqueta, pero no se puede agregar al carrito (`ventaBloqueada`) y `guardarPedidos` lo rechaza con `ArticuloNoDisponibleError`. Para resurtir.
- **Dado de baja** (`baja: true`): desaparece del catálogo público (`useArticulos` lo filtra); la tienda lo sigue viendo en su lista para reactivarlo. Funciones: `pausarVentaArticulo`, `darDeBajaArticulo`.
- Catálogo público (`useArticulos`) = artículos de tiendas que pueden vender, sin dados de baja, con el nombre vivo de la tienda.
- **Calificación** de artículos: desde la tarjeta y el detalle del producto (misma lógica que tiendas).

---

## 8. Carrito, checkout y pedidos

### Carrito (`CartView.vue`, Dexie `Carrito`)

Agrupado **por tienda**: cada bloque muestra nombre (enlace al perfil), cantidad, subtotal y estado abierta/cerrada. Los artículos de tiendas cerradas se atenúan, no cuentan en el total y no viajan al checkout ("Comprar N disponibles"). Al confirmar, solo salen del carrito los comprados (`quitarArticulosDelCarrito`).

**Carrito de invitado** (`src/db/carritoInvitado.ts`). Se puede llenar el carrito **sin haber iniciado sesión**: esos artículos se guardan en la misma tabla `Carrito` con `id_usuario = ID_INVITADO`, así que todas las pantallas siguen leyendo lo mismo. Quién es el dueño del carrito lo decide **`idCarritoActual()`** (el cliente si hay sesión, el invitado si no); **ningún punto del carrito debe volver a leer `sessionUser.value.id` directamente**, o el invitado dejaría de ver lo suyo.

Al iniciar sesión en ese dispositivo, `adoptarCarritoInvitado(uid)` pasa esas líneas al cliente y **suma las cantidades** si ya tenía el mismo artículo y variante. Se llama desde `sync.ts` **después de `bajar(uid)`**, nunca antes: `bajar` reemplaza lo local del usuario con la copia remota, así que adoptar primero borraría lo del invitado. Lo adoptado se sube enseguida a mano, porque `observar` se salta la primera emisión de cada tabla.

La **compra sí exige sesión** (`guardarPedidos` lanza si no hay usuario): un pedido pertenece a un cliente. Por eso "Continuar compra" manda a `/login?redirect=/cart` cuando no hay sesión; al entrar, el carrito ya es suyo y sigue ahí. Los **favoritos** siguen siendo solo de clientes con sesión: no se comparten con el invitado.

`CartView` lee la tabla **en vivo** (`liveQuery`), igual que `CartButton`. No es un detalle: al iniciar sesión el dueño del carrito cambia al instante, pero la adopción tarda lo que tarda la ida a Firebase de `bajar`. Con una lectura única la pantalla se quedaba vacía hasta salir y volver a entrar. Mientras dura ese hueco, `sincronizando` (de `sync.ts`) hace que se muestre "Cargando tu carrito…" en vez de anunciar que está vacío.

### Ciclo de vida de un pedido (`usePedidos.ts`)

```
Preparacion ──► Atendiendo ──► Enviado ──► Entregado
     │              │            │
     └──────────► Cancelado ◄────┘
```

- **Crear**: `guardarPedidos` valida tiendas (pueden vender, abiertas), artículos (no pausados/baja), descuenta stock por variante con transacción (si falta, revierte y lanza `StockInsuficienteError`) y guarda en `pedidos/` con `estatusPorTienda`, `historial` y `fecha_creacion` ISO.
- Un pedido puede incluir varias tiendas: cada una lleva su estatus en `estatusPorTienda`; el `estatus` global se deriva (`derivarEstatusGlobal`). En **`PedidoDetalle`** los artículos van **agrupados por tienda** (`gruposPorTienda`), y cada bloque muestra el estatus de **esa** tienda, su motivo de cancelación si aplica y **su propio total**; la suma de todas solo se imprime cuando hay más de una. Mismo patrón visual que el carrito.
- **El total del detalle no es `total_compra`.** Ese campo guarda lo que se pidió el primer día y deja de decir la verdad en cuanto una tienda cancela o entrega su parte. La pantalla muestra: con el pedido **abierto** (alguna tienda en `Preparacion`, `Atendiendo` o `Enviado`), **"POR LLEGAR"** con la suma de solo esas tiendas —lo entregado y lo cancelado ya no se suman—; y cuando **se cierra** (ninguna en proceso: todo entregado o cancelado), **"TOTAL ENTREGADO"** con lo que realmente llegó, que es `$0.00` si todo se canceló. La suma del pie usa la misma regla para no contradecir a la cabecera.
- **Cliente** cancela solo mientras ninguna tienda haya empezado a atender ni enviado **y dentro de los primeros `MINUTOS_LIMITE_CANCELACION_CLIENTE = 5` minutos** (`clientePuedeCancelar`). El stock regresa. Pasada la ventana, se cancela hablando con la tienda: la leyenda `MENSAJE_LIMITE_CANCELACION` vive en `usePedidos.ts` y se muestra en los tres lugares donde hace falta —el diálogo de «Gracias por tu compra», la pestaña **Mis pedidos** y el detalle del pedido—, para que todos digan lo mismo. La ventana se revisa **también en `cancelarPedidoCliente`**, no solo en la pantalla: el botón puede quedar visible si la vista lleva rato abierta. Los pedidos sin `fecha_creacion` ISO (anteriores a la regla) conservan su comportamiento.
- **Tienda**: Atender → Marcar enviado → Marcar entregado (puede saltar directo a enviado); cancela mientras no esté entregado, con **motivo obligatorio**. Para la tienda `Preparacion` se muestra como "Nuevo · sin atender" (`ESTATUS_LABEL_TIENDA`).
- **Atendiendo**: la tienda confirma que ya prepara el pedido; el cliente ve "Atendiendo tu pedido" (y "tus artículos bajo pedido se están elaborando" si aplica) y ya no puede cancelar; detiene el reloj de cancelación automática.
- **Cancelación automática** (`MINUTOS_LIMITE_ATENCION = 40`): si la parte de una tienda sigue en `Preparacion` 40 min después de la creación, el sistema la cancela (historial `por: 'sistema'`; `canceladoPor: 'sistema'` si era la única) y devuelve su stock. Corre al leer pedidos (cliente y tienda) dentro de una transacción sobre el pedido para no duplicarse. Solo aplica a pedidos con `fecha_creacion` ISO (los antiguos con fecha en texto no se tocan). La tienda ve el tiempo restante en cada tarjeta y en la campana.
- **Motivo de cancelación**: `motivoCancelacion(pedido, tiendaId?)` toma del historial quién canceló y la nota; `textoCancelacion(m, 'cliente' | 'tienda')` lo redacta para cada lector ("Cancelado por la tienda: …", "Cancelaste este pedido: …", o el texto automático). Se muestra en lista y detalle del cliente y en la tarjeta de la tienda, también cuando solo una tienda del pedido canceló (`cancelacionesPorTienda`).
- Cada transición queda en `historial` (estatus, fecha ISO, quién, tienda, nota). La pantalla de pedidos de la tienda escucha cambios en vivo (`onValue`).

---

## 9. Membresías y pago con Mercado Pago

Las tiendas pagan una membresía (`mensual` o `anual`) para vender. Precios en `configuracion.membresia.precioMensual/precioAnual`; días de gracia en `configuracion.membresia.diasGracia`.

**Dos modos**, elegidos en `configuracion.pagos.modo` (panel admin › Configuración):

| Modo | Flujo |
| --- | --- |
| `links` (manual) | La tienda abre `linkMensual`/`linkAnual` (links del panel de Mercado Pago), paga y pulsa "Ya pagué" → crea una solicitud en `solicitudesPago` (`reportado | atendido | descartado`) que el administrador confirma con "Registrar pago" (`useSolicitudesPago.ts`, `useAdminTiendas.ts`). Es el respaldo si el automático falla |
| `automatico` | La app pide al servidor una preferencia de Checkout Pro, redirige a Mercado Pago y el **webhook** activa la membresía solo |

**Flujo automático paso a paso**

1. `StoreProfile.vue` → `iniciarPagoMembresia()` (`useMercadoPago.ts`) hace `POST {VITE_API_URL}/pagos/membresia/crear { tiendaId, plan, origen }`.
2. `src/services/pagos/router.ts` valida `pagos.modo === 'automatico'` y que haya precio, crea la preferencia con `external_reference = membresia|tiendaId|plan|intentoId`, guarda `pagosMercadoPago/{intentoId}` en estado `pendiente` y devuelve `init_point`.
3. La tienda paga. Mercado Pago regresa a `/store/profile/:id?pago=exito|pendiente|error` (solo aviso visual) y avisa al servidor en `POST /pagos/membresia/webhook`.
4. El webhook valida la firma `x-signature` con `MP_WEBHOOK_SECRET`, consulta `/v1/payments/{id}` y, si está `approved` y el monto alcanza, aplica `cambiosParaPagoAprobado()` (`logicaPago.ts`): registra el pago en `tiendas/{id}/pagosMembresia`, extiende `membresia.vigenteHasta`, pone la tienda en `activa` y marca el intento como `aprobado`. Deja exactamente los mismos datos que un pago manual del admin.
5. `GET /pagos/membresia/estado` dice si el servidor tiene las variables necesarias (`activo`, `faltan`).

Archivos del servidor: `src/services/pagos/{router,logicaPago,mercadoPagoApi,almacen}.ts`. `almacen.ts` escribe en Realtime Database con firebase-admin si hay cuenta de servicio, o por la API REST si no.

**Cómo probar un pago simulado (checklist)**

1. `curl https://mavi-api.onrender.com/pagos/membresia/estado` → debe dar `{"activo":true}` (la primera llamada puede tardar ~1 min).
2. En la base: `configuracion.pagos.modo` = `automatico` y precios > 0. **El monto no puede ser muy bajo:** con precios de $1 el checkout responde "La operación no acepta este medio de pago" porque está por debajo del mínimo de Mercado Pago. Usa precios reales (p. ej. $20–$50 MXN o más).
3. `MP_ACCESS_TOKEN` en Render debe ser el de **pruebas** (`TEST-`). Verificar con `curl -H "Authorization: Bearer $TOKEN" https://api.mercadopago.com/users/me`.
4. En Mercado Pago › Tus integraciones › Webhooks (modo pruebas) debe estar `https://mavi-api.onrender.com/pagos/membresia/webhook` con el evento **Pagos**, y su clave debe coincidir con `MP_WEBHOOK_SECRET`.
5. Entrar a la app publicada con una tienda → perfil → "Ir a pagar" → elegir plan. En el checkout usar un **usuario comprador de prueba** (con token `TEST-` una cuenta real no puede pagar) y tarjeta de prueba, p. ej. Visa `4075 5957 1648 3764`, CVV `123`, titular `APRO` (aprobado) u `OTHE` (rechazado).
6. Resultado esperado: aviso "¡Pago recibido!", la tienda queda `activa` con `membresia.vigenteHasta` extendido y `pagosMercadoPago/{intentoId}.estado === 'aprobado'`.
7. Para depurar: logs del servicio en Render ("Pago de membresía aprobado" / "Webhook ... firma inválida" / "pago no encontrado"). La prueba del simulador de webhooks de MP responde 200 con `ignorado` porque ese pago no existe.

**Salir a producción**: cambiar `MP_ACCESS_TOKEN` por el `APP_USR-...` y `MP_WEBHOOK_SECRET` por la clave del webhook de producción en Render; registrar el webhook de producción con la misma URL; llenar `FIREBASE_SERVICE_ACCOUNT_JSON`.

### Recuperar contraseña (servidor)

El cliente que olvidó su contraseña la recupera **sin que el navegador conozca ni valide el código**. Vive en el servidor Express (`src/services/recuperacion/`):

| Endpoint | Qué hace |
| --- | --- |
| `POST /recuperar-password/solicitar { telefono }` | Busca al cliente por celular; genera un código de 4 dígitos, lo guarda **hasheado** (bcrypt) en memoria del proceso con caducidad (`MINUTOS_VIGENCIA = 10`) y lo envía por correo. Responde `{ ok, email }` con el correo oculto (`b***@gmail.com`). Sin cuenta/correo → 404 |
| `POST /recuperar-password/cambiar { telefono, codigo, nuevaPassword }` | Verifica el código **en el servidor** (caducidad + `MAX_INTENTOS = 5`) y, si es correcto, escribe la nueva contraseña (hash) en `usuarios/{id}/pass` y descarta la solicitud (un solo uso) |

**Envío del correo.** En **local** se manda por el SMTP de Gmail (`SMTP_USER`/`SMTP_PASS`). En **producción (Render)** el SMTP directo a Gmail está bloqueado (da `Connection timeout`), así que el correo se manda por la **API HTTP de Brevo**: si existe `BREVO_API_KEY` se usa Brevo, si no, SMTP. El remitente es `SMTP_USER` y debe estar **verificado en Brevo**. Diagnóstico: `node scripts/probar-correo.mjs [telefono]` (local, SMTP).

El código se guarda en memoria, no en la base: es privado (la base es de lectura abierta) y si el servidor se reinicia, se pide de nuevo. La reglas puras (código, caducidad, intentos, validación) están en `logica.ts` y se prueban solas. `ForgotPassword.vue` solo pide teléfono → código + contraseña nueva; ya no genera ni compara nada.

**Teléfono con guiones.** El campo del teléfono se muestra formateado `375-124-1114` (formato 3-3-4) mientras se escribe; al servidor se le mandan **solo los dígitos** (`soloDigitosTel`). Da igual con guiones o sin ellos: el servidor normaliza con `soloDigitos`.

**En local hacen falta DOS procesos a la vez:** `npm run dev` (la app, puerto 5173) y `npm run server` (el que envía el correo, puerto 3000; configurable con `PORT` en `.env`). El navegador **no** manda correo por sí mismo: le pide al servidor Express que lo haga, por eso ambos deben estar encendidos. `VITE_API_URL` debe apuntar al puerto del servidor. En producción esto no aplica: el servidor vive en Render, siempre encendido. Para diagnosticar el correo sin la app: `node scripts/probar-correo.mjs [telefono]` prueba la conexión, la autenticación con Gmail y el envío, e imprime el error exacto si falla.

#### Configurar el correo en producción con Brevo (checklist)

Render bloquea el SMTP saliente, así que producción manda por la API HTTP de Brevo. Una sola vez:

1. **Crea la cuenta** en [brevo.com](https://www.brevo.com/) (es distinta de folk.app u otras; asegúrate de estar en `app.brevo.com`).
2. **API key HTTP:** en `app.brevo.com/settings/keys/api`, pestaña **"API keys"** (NO la de "SMTP"), genera una que empiece con **`xkeysib-`**. La de SMTP (`xsmtpsib-`) **no sirve** aquí.
3. **Verifica el remitente:** **Senders, Domains & Dedicated IPs → Senders → Add a sender** con el mismo correo que `SMTP_USER` (p. ej. `tu-correo@gmail.com`); abre el correo de confirmación de Brevo y pulsa el enlace hasta que quede con ✓ verde. Sin esto, Brevo acepta la llamada pero **rechaza el envío** ("the sender ... is not valid").
4. **Autoriza las IPs de Render:** si Brevo tiene activada la seguridad de "IPs autorizadas", agrega las **Outbound IP Addresses** del servicio de Render (Render → servicio → Settings → *Outbound IP Addresses*, son fijas) en `app.brevo.com/security/authorised_ips`. Si no, Brevo responde `401 unrecognised IP address`. (Local usa tu propia IP; agrégala igual si quieres probar el camino Brevo en local.)
5. **En Render → Environment:** `BREVO_API_KEY=xkeysib-...` (y `SMTP_USER` con el remitente verificado). En los logs del arranque debe verse `BREVO_API_KEY: Cargada ✅`.
6. **Verifica** en Brevo → **Transactional → Logs**: cada correo muestra su estado real (Delivered / Blocked / Bounce / rechazo por remitente). Ahí se ve el motivo si algo no llega.

---

## 10. Administración

- **Cuentas** (`admins/{id}`: `nombre, telefono, password(hash bcrypt), rol, activo, creadoEn, ultimoAcceso`). Roles: `superadmin` y `admin`. El primer administrador se crea con `node scripts/crear-admin.mjs`; los demás desde `/admin/cuentas`.
- Solo un **superadmin** crea, edita, cambia contraseña y activa/desactiva cuentas; un `admin` solo ve la lista. Reglas en `motivoBloqueoCambio`: nadie se desactiva a sí mismo ni se quita el rol de superadmin, y siempre debe quedar al menos un superadmin activo.
- **Un celular, dos accesos**: si el celular con el que entra un cliente (`/login`) también está en `admins/` y activo, tras validar la contraseña de cliente se pregunta "¿Cómo quieres entrar?" (cliente o administrador), en **cada** inicio de sesión. Como administrador se valida la misma contraseña contra el hash del admin; si es distinta se manda a `/admin/login?tel=…` con el celular prellenado. Hoy solo el celular 3751241114 cumple la condición (cliente "Carlos Gaspar" y superadmin "Administrador").
- Tablero: contadores por estatus, tiendas pendientes de aprobación, por vencer en 7 días, avisos "Ya pagué" por confirmar (con campana en `AdminTopbar`) y última corrida de la revisión de membresías.
- Registrar un pago (manual o automático) siempre deja la tienda `activa`: autoriza pendientes y reactiva bloqueadas o vencidas. La vigencia se cuenta desde hoy, o desde la vigencia actual si aún no venció. Historiales en `tiendas/{id}/historialEstatus` y `tiendas/{id}/pagosMembresia`.
- Para **publicar productos** una tienda necesita membresía vigente; una tienda activa sin membresía sigue vendiendo lo ya publicado pero no publica nuevo (guard en `ProductForm` y en el botón ➕ del perfil).
- **Cerrar el registro de tiendas nuevas** (`configuracion.registro.tiendasAbierto`): interruptor en `/admin/tiendas` (y en `/admin/configuracion`, con mensaje personalizable). Cerrarlo oculta el enlace "¿Tienes una tienda?" del login del cliente, oculta el botón de registro en `/store/login` y bloquea el alta en `/store/register`. **No afecta a los clientes** (siguen comprando) **ni a las tiendas existentes** (siguen operando y sus dueños siguen entrando). Sirve para pausar altas mientras se hace algún ajuste.
- Categorías: al renombrar se propaga a tiendas y artículos; no se elimina una categoría en uso.

---

## 11. Pruebas

```bash
npm test
```

La suite corre sin tocar Firebase real: `tests/mocks/firebaseDb.ts` es un Firebase en memoria (`get`, `set`, `update`, `push`, `query`, `onValue`, `runTransaction`, con `__reset`, `__getAt`, `__getTree`) y Dexie usa `fake-indexeddb`. `tests/setup.ts` mockea `vue-router` (`routerMock`, `routeMock`) y SweetAlert2 (`swalMock`); `tests/helpers.ts` tiene `withSetup` (composables con ciclo de vida) y `flush`.

| Archivo | Cubre |
| --- | --- |
| `pedidos.flujo.spec.ts` | Ciclo de pedidos desde cliente y tienda: creación, stock, cancelaciones, transiciones, pedidos antiguos |
| `pedidos.componentes.spec.ts` | `StorePedidos` y `PedidoDetalle` montados: Atender, enviar, entregar, cancelar, filtros, actualización en vivo |
| `pedidolist.spec.ts` | "Mis pedidos": pestañas, conteos, artículos, filtros |
| `atenderPedido.spec.ts` | Estatus Atendiendo, motivos de cancelación para cliente y tienda, artículos bajo pedido |
| `pedidosSinAtender.spec.ts` | Cancelación automática a las 2 h: tiempo restante, cancelación parcial/total, devolución de stock, expiración al leer |
| `horarioTienda.spec.ts` | Horario: regla pura (días, cierre exclusivo, medianoche, próxima apertura), mapa compartido y candado al guardar |
| `carrito.cliente.spec.ts` | Carrito rápido con límites de stock, tiendas favoritas, contador de `CartButton` |
| `cartview.navegacion.spec.ts` | Carrito agrupado por tienda; el estado enviado a `/checkout` debe ser clonable |
| `nombreTienda.spec.ts` | Renombrar tienda propaga a artículos; catálogo y carrito muestran el nombre vivo |
| `calificaciones.spec.ts` | Promedio, voto por cliente, `StarRating`, portada (`CategoriasScroll`, `TiendasDestacadas`) |
| `compartir.spec.ts` | Compartir tienda y producto: enlaces por destino, menú del sistema (incluido el cierre sin elegir), lista de respaldo y el botón dentro de `ProductDetail` |
| `alertasTienda.spec.ts` | Campana: reglas de stock, pedidos por atender, pausar venta / dar de baja y su efecto en catálogo, carrito y pedido |
| `pullToRefresh.spec.ts` | Gesto de deslizar para actualizar: umbral, scroll, estado refrescando |
| `membresia.spec.ts`, `vencimientos.spec.ts` | Estatus efectivo, vigencias, avisos y bloqueo de venta |
| `solicitudesPago.spec.ts`, `pagoAutomatico.spec.ts` | Modo manual ("Ya pagué") y servidor de pagos (preferencia, firma del webhook, activación) |
| `recuperacion.spec.ts` | Recuperar contraseña en el servidor: código hasheado con caducidad, intentos máximos, cambio de contraseña de un solo uso |
| `admin.login.spec.ts`, `adminCuentas.spec.ts` | Login de admin y guard; gestión de cuentas y elección cliente/administrador en `/login` |
| `banners.spec.ts` | Banners de la portada: regla de vigencia (activo + fechas) y CRUD del admin (crear, actualizar, ocultar, eliminar) |
| `municipios.spec.ts` | Municipios (125, alcance opt-in, sembrar sin duplicar, marcar todos, eliminar, nombre "San Martín de Hidalgo") y colonias por CP / por municipio (parseo y búsqueda tolerante a fallos) |
| `coloniasLocales.spec.ts` | Catálogo de colonias de Jalisco guardado en la app: listas por municipio, C.P. de cada colonia (y cuándo no se puede afirmar) y que no se consulta la API |
| `adminClientes.spec.ts` | Soporte a clientes desde el admin: búsqueda, restablecer contraseña (hash) y editar nombre/correo |
| `admin.tiendas.spec.ts`, `admin.categorias.spec.ts`, `configuracion.spec.ts` | Panel de tiendas (incluido el interruptor de registro de tiendas), categorías y nodo `configuracion` |
| `productForm.spec.ts`, `productCard.spec.ts`, `productosList.spec.ts` | Alta/edición de productos, la tarjeta de la lista del inicio y la lista pública |
| `storeEdit.spec.ts`, `envio.spec.ts`, `favoritasSync.spec.ts`, `tiendasFavoritas.spec.ts`, `direcciones.spec.ts`, `sync.spec.ts` | Editar tienda, envío a domicilio, favoritas y su sincronización, libreta de direcciones, respaldo local↔Firebase |

---

## 12. Scripts de mantenimiento

Todos leen `VITE_FIREBASE_DATABASE_URL` del `.env` y usan la API REST de la base (si las reglas exigen auth, `FIREBASE_AUTH_TOKEN`). Los de migración aceptan simulación (sin `--apply`) para ver qué cambiaría.

| Script | Para qué |
| --- | --- |
| `node scripts/crear-admin.mjs --telefono … --nombre … --password … [--rol superadmin]` | Primer administrador |
| `node scripts/sincronizar-nombre-tienda.mjs [--apply]` | Copiar el nombre actual de cada tienda a sus artículos |
| `node scripts/migrar-estado-tiendas.mjs [--apply]` | Dejar explícito `estatus` en tiendas antiguas |
| `node scripts/migrar-categoriaId.mjs [--apply]` | Asignar `categoriaId` a artículos que solo tienen el nombre |
| `node scripts/revisar-membresias.mjs` | Correr a mano la revisión de membresías |
| `node scripts/probar-correo.mjs [telefono]` | Diagnóstico del correo (SMTP de Gmail): conexión, autenticación y envío; si pasas un celular, busca ese usuario y le envía |
| `node scripts/cargar-municipios-jalisco.mjs [--apply]` | Carga los 125 municipios de Jalisco en el nodo `municipios` (idempotente; no duplica; conserva los que ya tienen colonias) |
| `node scripts/generar-colonias-jalisco.mjs [--csv ruta.csv]` | Regenera `src/data/coloniasJalisco.json` (colonias de los 125 municipios de Jalisco con su C.P.) desde el padrón de SEPOMEX. Solo hace falta cuando cambie el padrón o se agregue un ajuste |
| `node scripts/establecer-password.mjs --password … ( --telefono … | --todos ) [--apply]` | Fijar una contraseña (hash bcrypt) a un cliente/admin por celular, o a todos |

---

## 13. Pendientes conocidos

- Reglas de seguridad de Firebase: la base no tiene reglas versionadas en el repo. Agregar reglas por nodo y `".indexOn": ["id_usuario"]` en `pedidos`.
- `FIREBASE_SERVICE_ACCOUNT_JSON` sigue vacío en Render: el servidor escribe en la base por la API REST abierta. Llenarlo antes de producción.
- Las credenciales de Mercado Pago en Render son de prueba (`TEST-`).
- `FIREBASE_STORAGE_BASE_URL` en `src/constants/firebase_util.ts` debe apuntar a la URL real de imágenes.
- Artículos antiguos no tienen `categoriaId`; la app compara por nombre como respaldo. Conviene migrarlos.
- Recuperar contraseña existe solo para clientes (no para tiendas ni admins). El flujo ya es server-side (`src/services/recuperacion/`); requiere `SMTP_USER`/`SMTP_PASS` en el servidor.
- El repositorio tiene `package-lock.json` y `yarn.lock`; usar solo uno.
- No se ha hecho una revisión visual pantalla por pantalla en modo oscuro; si algún texto queda sin contraste, corregirlo con los tokens.
- El repositorio es público y en algún momento `.env` estuvo versionado: conviene rotar la contraseña de aplicación de Gmail y regenerar el token TEST de Mercado Pago. Existe un nodo `Mpago` en la base con un token viejo que conviene borrar.
- **Rotar credenciales que estuvieron a punto de subirse** (GitHub Push Protection las frenó): la API key de Brevo y la contraseña de aplicación de Gmail. Regenerarlas y dejarlas solo en el `.env` local y en Render. `.gitignore` ya cubre `.env`, `.env.*` y `*.env`, pero conviene no dejar copias de secretos en la carpeta del repo.
- `functions/package.json` tiene la dependencia `mercadopago` sin uso.

---

## 14. Bitácora de decisiones

Decisiones de producto y técnicas tomadas durante el desarrollo, con su razón, para no volver a discutirlas.

| Fecha | Decisión | Por qué |
| --- | --- | --- |
| 2026-09 | El campo de control de tienda se llama `estatus` | `estado` ya era el estado geográfico |
| 2026-09 | Login de admin propio (celular + hash bcrypt), sin Firebase Auth | Mismo esquema que clientes y tiendas |
| 2026-09-06 | Tienda cerrada: se puede guardar en carrito, no comprar | El cliente no pierde su selección; la tienda no recibe pedidos fuera de horario |
| 2026-09-06 | Cancelación automática a las 2 h solo para pedidos con `fecha_creacion` ISO | La fecha en texto de pedidos antiguos depende del idioma; no es confiable para cancelar solo |
| 2026-09-06 | Nuevo estatus `Atendiendo` en vez de tratar "confirmar" como `Enviado` | La tienda necesita confirmar pedidos que tardan (bajo pedido) sin que se cancelen ni parezcan enviados |
| 2026-09-06 | Motivo de cancelación obligatorio para la tienda | El cliente veía "cancelado" sin explicación |
| 2026-09-06 | Los pedidos conservan el nombre histórico de la tienda; catálogo y carrito muestran el vivo | Un pedido es un registro; el catálogo debe reflejar el presente |
| 2026-09-06 | Tema claro/oscuro con tokens, no forzar claro | El usuario pidió adaptarse al sistema; el bug era texto blanco heredado sobre tarjetas blancas |
| 2026-09-06 | Pull to refresh remonta la vista (`key`) en vez de `location.reload()` | Mantiene sesión y carrito, es instantáneo y cubre todas las pantallas |
| 2026-09-19 | El gesto de deslizar para actualizar solo arranca desde la cabecera (`SELECTOR_CABECERA`) | Escuchando en toda la página, el `preventDefault` de `onMove` entorpecía el desplazamiento normal en todas las pantallas. Desde la cabecera el gesto es igual de alcanzable y el contenido se desplaza libre |
| 2026-09-19 | La flecha de regresar del formulario de artículo pide confirmación si hay captura sin guardar | Hacía `$router.back()` directo: un toque en el paso 3, con todo lleno, tiraba el trabajo sin aviso. Se compara contra un retrato tomado al abrir, así en edición lo ya publicado no cuenta como cambio |
| 2026-09-19 | Perfil de tienda y detalle de producto regresan con `volverOInicio`, no con `router.back()` | Son las dos pantallas que se comparten por enlace. Quien lo abre entra sin historial propio, así que `back()` no llevaba a ningún lado y dejaba a la persona atrapada. Se mira `history.state.back` (lo llena Vue Router) y, si no hay, se manda a la portada con `replace` |
| 2026-09-19 | El carrito se puede llenar sin sesión y se adopta al entrar (`ID_INVITADO`, `idCarritoActual()`) | Pedir cuenta antes de dejar elegir espanta al cliente nuevo. El carrito vive en el dispositivo de todas formas, así que basta con marcar de quién es y cambiarle el dueño al iniciar sesión. La sesión se pide al pagar, que es cuando el pedido necesita un cliente |
| 2026-09-19 | La adopción corre después de `bajar(uid)`, no antes | `bajar` reemplaza lo local del usuario con la copia remota; adoptando primero, lo del invitado se borraba antes de llegar a ser suyo |
| 2026-09-19 | El total del detalle del pedido es "por llegar" mientras esté abierto y "entregado" al cerrarse, no `total_compra` | `total_compra` es una foto del día que se pidió: con una tienda cancelada o ya entregada, cobraba de más. El cliente quiere saber cuánto le falta recibir y, al final, por cuánto fue realmente el pedido |
| 2026-09-19 | El cliente solo cancela en los primeros 5 minutos; después, hablando con la tienda | Pasados unos minutos la tienda ya pudo comprar insumos o empezar a cocinar: cancelar con un botón deja de ser gratis para ella. La leyenda se muestra al confirmar la compra, en "Mis pedidos" y en el detalle |
| 2026-09-19 | El límite para que la tienda atienda bajó de 2 h a 40 min | Dos horas era demasiado para comida: el cliente se quedaba esperando sin respuesta. A los 40 min el sistema cancela y le devuelve el dinero de su tiempo |
| 2026-09-06 | Calificaciones: un voto por cliente, promedio calculado al leer | Evita acumulados desincronizados; el nodo completo es pequeño |
| 2026-09-06 | Calificar tiendas solo desde su perfil; portada y lista muestran estrellas de lectura | El usuario quería ver la nota en todas partes pero votar solo con contexto |
| 2026-09-06 | Portada: tiendas en carrusel horizontal (máx. 10) con `TiendaCard`; lista completa en `/tiendas` con el mismo diseño | Una sola tarjeta compartida evita dos diseños divergentes |
| 2026-09-06 | Panel de la campana teleportado a `<body>` | El banner del perfil tiene `overflow: hidden` y lo recortaba |
| 2026-09-06 | Pausar venta y dar de baja como estados del artículo, sin borrar | La tienda resurte o retira sin perder el producto ni su historial |
| 2026-09-06 | `PageHeader` sticky por defecto + `TopBarFija` en cabeceras grandes | Título y regreso visibles en todas las pantallas sin rehacer las portadas |
| 2026-09-06 | Elección cliente/administrador basada en datos (celular presente en `admins/`), no en un número fijo | Funciona para cualquier admin que también sea cliente |
| 2026-09-06 | Gestión de cuentas solo para `superadmin`, con salvaguardas | Evitar quedarse sin acceso al panel |
| 2026-09-16 | Recuperar contraseña con el código generado y verificado en el servidor | En el navegador el código era decorativo: se generaba y comparaba en el cliente, así que no protegía nada |
| 2026-09-16 | El código se guarda en memoria del servidor, no en la base | La base es de lectura abierta; en memoria no se expone. Si el servidor se reinicia, se pide de nuevo |
| 2026-09-16 | El teléfono del recuperar contraseña se muestra con guiones, se envía solo con dígitos | Más legible al escribir; el servidor normaliza igual |
| 2026-09-16 | La preferencia de pago ya no fija `payer.email` con el correo de la tienda | Anclaba el Checkout Pro al modo "Sin cuenta" y rechazaba las tarjetas de prueba ("La operación no acepta este medio de pago"); el pagador se identifica en el checkout |
| 2026-09-16 | Los precios de membresía deben superar el mínimo de Mercado Pago | Con $1 el checkout rechaza el medio de pago ("La operación no acepta este medio de pago") por monto bajo; usar precios reales |
| 2026-09-16 | Cerrar el registro de tiendas se controla también desde `/admin/tiendas` y oculta el "¿Tienes una tienda?" del cliente | Pausar altas nuevas sin frenar a clientes ni a tiendas existentes; el enlace del cliente no respetaba el flag |
| 2026-09-16 | El panel "Pagos por confirmar" del admin se teleporta a `<body>` (centrado en móvil, desplegable en escritorio) | Como desplegable quedaba recortado/estrecho en móvil; mismo patrón que la campana de las tiendas |
| 2026-09-16 | `auto_return` solo se envía cuando `back_urls.success` es https | Mercado Pago rechaza la preferencia con URL de retorno en localhost ("auto_return invalid. back_url.success must be defined"); así se puede probar el pago en local |
| 2026-09-16 | El correo se envía por API HTTP de Brevo en producción (SMTP solo en local) | Render bloquea el SMTP saliente a Gmail ("Connection timeout"); la API de Brevo viaja por https y sí sale |
| 2026-09-16 | En Brevo hay que verificar el remitente y autorizar las IPs de salida de Render | Brevo acepta la llamada pero rechaza el envío si el remitente no está verificado, y da 401 si la IP no está autorizada |
| 2026-09-16 | Registro de tienda: estado fijo "Jalisco", campo "País: México" no editable, y los 125 municipios de Jalisco | Por ahora todas las tiendas son de Jalisco; los municipios salen del nodo `municipios` (se cargan con el script). La colonia es lista si el municipio tiene colonias cargadas, o texto libre si no |
| 2026-09-16 | Banners de la portada administrables (`banners/`), con imagen, título, subtítulo, enlace, vigencia, activo y orden | Un carrusel arriba de "Explorar" que el admin controla sin tocar código; el enlace hace clickeable el banner y la vigencia permite promos por fechas |
| 2026-09-16 | Municipios con `alcance` (check en /admin/municipios); registro y edición de tienda solo muestran los que tienen alcance | El admin controla la cobertura sin tocar código; `alcance` ausente = disponible, para no romper lo existente |
| 2026-09-19 | San Martín de Hidalgo tiene su lista de localidades guardada en la app (`coloniasLocales.ts`) | SEPOMEX no devuelve nada para ese municipio, ni por nombre ni por C.P. Es una tabla por municipio, no un caso especial: agregar otro es una entrada más. Como la lista se hizo a mano y puede tener huecos, ahí se ofrece como sugerencia y se sigue aceptando texto libre; con las listas de la API, que son el padrón, la validación sigue siendo estricta |
| 2026-09-19 | `api-sepomex.hckdrk.mx` se encontró caída por completo (HTTP 000) | Es la segunda API de colonias que se cae (antes Icalia). Mientras esté así, ningún municipio carga colonias y todos dependen del texto libre. Conviene dejar de depender de una API gratuita para esto |
| 2026-09-20 | El menú lateral del perfil de tienda también sigue el tema (botón ☰, círculos de acciones y fondo de la pantalla) | Mismo problema que el del inicio: el ☰ era azul marino fijo y en oscuro se perdía contra el fondo (casi el mismo color), y los círculos eran gris claro fijo. En oscuro el ☰ pasa al azul claro. Se quitó una regla muerta (`.menu-item:nth-child(2)`, que nunca aplicaba porque el botón es el primer hijo de su contenedor) |
| 2026-09-20 | El menú lateral del inicio sigue el tema: blanco hueso en claro, superficie del tema en oscuro | Su fondo estaba fijo en `#f5f1eb` mientras el texto usaba `var(--text)`; en modo oscuro quedaban letras casi blancas sobre fondo casi blanco. De paso, el azul del hover se aclara en oscuro (el azul marino de marca se perdía contra la superficie) y se quitó un bloque de estilos del menú que estaba repetido tal cual |
| 2026-09-20 | En teléfono el inicio muestra **dos tarjetas por renglón** (la misma `ProductCard` de escritorio). Se eliminaron `ProductListItem.vue` y `useIsMobile`, que solo servían para alternar entre los dos diseños | Como fila, la foto quedaba demasiado chica para antojar, y sostener dos diseños de lo mismo costaba el doble. Con la tarjeta, el teléfono gana foto grande, calificación, etiqueta de estado y carrito sin entrar al detalle. Los botones de "Agregar" se alinean entre tarjetas del mismo renglón, aunque el nombre ocupe uno o dos renglones |
| 2026-09-20 | Las colonias de **todo Jalisco** viven en la app (`src/data/coloniasJalisco.json`: 125 municipios, 5,788 colonias con su C.P.) | Las dos APIs que se usaron se cayeron, y con ellas se quedaba sin lista todo el estado. El padrón de SEPOMEX cambia poco, así que guardarlo sale más barato que depender de un servicio gratuito. Se genera con `scripts/generar-colonias-jalisco.mjs` (ahí quedan escritos los ajustes hechos a mano) y se carga aparte, solo cuando hace falta: 164 KB, 47 KB comprimido |
| 2026-09-20 | Al elegir (o escribir completa) la colonia, el C.P. se pone solo en el registro y en la edición de tienda, en cualquier municipio | Va en dirección colonia → C.P., la contraria a `AUTOCOMPLETAR_POR_CP`, que sigue apagado: ese depende de la API caída y este sale del catálogo. Si de esa colonia no se puede afirmar el C.P. —no está en el catálogo, o el padrón le da varios, como "San Antonio" en Guadalajara— no se toca lo que la tienda escribió; el campo se corrige a mano siempre |
| 2026-09-20 | La lista del catálogo es sugerencia, no padrón cerrado: solo se exige elegir de la lista cuando la curó el admin o vino de la API | El padrón de SEPOMEX tiene huecos (a San Martín le faltaba La Loma, que se agregó a mano), así que exigirlo dejaría fuera a colonias que sí existen |
| 2026-09-16 | Colonias por código postal (API gratuita en vivo), con degradado a captura manual | Cargar todas las colonias de Jalisco es inviable/pesado; por CP es preciso y ligero. Si la API falla, el formulario sigue con texto libre |
| 2026-09-16 | Al elegir municipio también se listan sus colonias por API (por municipio), además del CP | El usuario quería ver la lista del municipio sin escribir CP; mejor esfuerzo y con degradado a texto libre |
| 2026-09-16 | Editar tienda usa el mismo selector de dirección que el registro (municipio, colonia, estado fijo Jalisco, país México) | Consistencia entre alta y edición |
| 2026-09-16 | Alcance de municipios es opt-in (solo `alcance === true`), con botones marcar/desmarcar todos | El admin decide activamente dónde hay cobertura; por defecto nada seleccionado |
| 2026-09-16 | Encabezado "Explorar" con enlace "Ver más productos" (→ /productos), como el de Tiendas | Consistencia visual entre secciones de la portada |
| 2026-09-16 | El admin puede dar soporte a clientes desde /admin/cuentas (restablecer contraseña, editar datos) | Resolver problemas de acceso de clientes sin tocar la base a mano |
| 2026-09-16 | API de colonias cambiada de Icalia Labs a `api-sepomex.hckdrk.mx` | El dominio de Icalia dejó de resolver (DNS caído); ambas consultas (por CP y por municipio) dependían de él |
| 2026-09-16 | El nombre oficial usado es "San Martín de Hidalgo" (con "de"); botón para eliminar municipios en /admin/municipios | La lista sembraba "San Martín Hidalgo" y duplicaba la entrada original con colonias; eliminar permite limpiar duplicados/errores |
| 2026-09-16 | `.gitignore` refuerza el ignorado de secretos: `.env`, `.env.*` y `*.env` | Se habían perdido las líneas de `.env` y una copia (` - copia.env`) casi se sube; GitHub Push Protection lo frenó |
| 2026-09-16 | Compartir con `navigator.share` y lista propia solo de respaldo | La hoja del sistema ya trae WhatsApp y todo lo instalado; mantener una lista fija se desactualiza y se ve ajena al teléfono |
| 2026-09-16 | El enlace a compartir se arma con la ruta, no con `location.href` | Evita compartir `?pago=exito` u otra query del momento |
| 2026-09-16 | El botón de compartir también lo ve la dueña o dueño | Es quien más difunde su propia tienda |
| 2026-09-16 | Compartir vive en la tarjeta del perfil y como círculo flotante en el producto | En el perfil compite con la campana y el corazón del banner; en el producto la columna derecha ya es la de acciones |
| 2026-09-16 | `BotonCompartir` con un solo nodo raíz, sin `inheritAttrs: false` | Con dos raíces (botón + Teleport) el componente no hereda el `data-v-` del padre y sus estilos scoped no aplican, sin error ni aviso |
| 2026-09-16 | El mensaje al compartir un producto no incluye el precio | Cada variante tiene el suyo y cambia; el texto quedaría contradiciendo la pantalla que se abre |
