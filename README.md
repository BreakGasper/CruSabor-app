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
| Servidor | Express (`src/services/main.ts`): recuperar contraseña (código en el servidor) con Nodemailer y pagos de membresía con Mercado Pago. Publicado en Render (`render.yaml`) |
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

`PullToRefresh.vue` envuelve el `router-view` en `App.vue`. Si la página y el contenedor bajo el dedo están arriba del todo y se arrastra hacia abajo más de 70 px, emite `refresh`; `App.vue` incrementa la `key` del `router-view`, la vista se desmonta y vuelve a montar y repite sus cargas de `onMounted`. No recarga la página ni toca sesión o carrito local. Existe porque `overscroll-behavior: contain` desactiva el gesto nativo y en modo PWA no hay botón de recargar.

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
| `/admin/tiendas`, `/admin/tiendas/:id` | Tiendas: estatus, membresías, registrar pagos manuales, historial |
| `/admin/categorias` | Catálogo de categorías (con propagación del nombre a tiendas y artículos) |
| `/admin/configuracion` | Nodo `configuracion`: precios de membresía, días de gracia, modo de pago (`links` / `automatico`), mantenimiento, registro abierto |
| `/admin/cuentas` | Cuentas de administrador: crear, editar, contraseña, activar/desactivar |

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

`BotonCompartir` tiene **un solo nodo raíz** (un `<span>` que envuelve al botón y al `Teleport`). No es cosmético: con dos raíces Vue no le pasa el `data-v-` del padre y **cualquier regla scoped del padre deja de aplicar en silencio** —posición, márgenes, centrado—. `tests/compartir.spec.ts` lo vigila comprobando que el envoltorio lleve también el scope de la pantalla que lo usa.

### Favoritas y calificación

- Tiendas favoritas por cliente en Dexie (`useTiendasFavoritas`), respaldadas en Firebase.
- **Calificaciones** (`useCalificaciones.ts`, `StarRating.vue`): `calificaciones/{articulos|tiendas}/{id}/{usuarioId} = { estrellas, fecha }`. Un voto por cliente (volver a votar lo reemplaza); promedio y total se calculan al leer (`resumirVotos`). Se califica una **tienda** solo desde su perfil (la dueña o dueño ve el promedio sin votar); en la portada y en `/tiendas` las estrellas son de lectura. Sin sesión de cliente se ofrece ir al login.

### Perfil propio y campana de avisos (`CampanaTienda.vue`, `useAlertasTienda.ts`)

La dueña o dueño ve en su perfil y en su lista de productos una campana con: **pedidos por atender** (su parte en `Preparacion`, con el tiempo que queda antes de la cancelación automática) y artículos **agotados** o **por agotarse** (`resumenStock`: alguna variante con stock ≤ `UMBRAL_STOCK_BAJO = 3`; no aplica a stock ilimitado, bajo pedido ni dados de baja). El panel se teleporta a `<body>` (hoja inferior en móvil, diálogo en escritorio) y ofrece pausar venta, dar de baja y editar stock.

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

### Ciclo de vida de un pedido (`usePedidos.ts`)

```
Preparacion ──► Atendiendo ──► Enviado ──► Entregado
     │              │            │
     └──────────► Cancelado ◄────┘
```

- **Crear**: `guardarPedidos` valida tiendas (pueden vender, abiertas), artículos (no pausados/baja), descuenta stock por variante con transacción (si falta, revierte y lanza `StockInsuficienteError`) y guarda en `pedidos/` con `estatusPorTienda`, `historial` y `fecha_creacion` ISO.
- Un pedido puede incluir varias tiendas: cada una lleva su estatus en `estatusPorTienda`; el `estatus` global se deriva (`derivarEstatusGlobal`).
- **Cliente** cancela solo mientras ninguna tienda haya empezado a atender ni enviado. El stock regresa.
- **Tienda**: Atender → Marcar enviado → Marcar entregado (puede saltar directo a enviado); cancela mientras no esté entregado, con **motivo obligatorio**. Para la tienda `Preparacion` se muestra como "Nuevo · sin atender" (`ESTATUS_LABEL_TIENDA`).
- **Atendiendo**: la tienda confirma que ya prepara el pedido; el cliente ve "Atendiendo tu pedido" (y "tus artículos bajo pedido se están elaborando" si aplica) y ya no puede cancelar; detiene el reloj de cancelación automática.
- **Cancelación automática** (`HORAS_LIMITE_ATENCION = 2`): si la parte de una tienda sigue en `Preparacion` 2 h después de la creación, el sistema la cancela (historial `por: 'sistema'`; `canceladoPor: 'sistema'` si era la única) y devuelve su stock. Corre al leer pedidos (cliente y tienda) dentro de una transacción sobre el pedido para no duplicarse. Solo aplica a pedidos con `fecha_creacion` ISO (los antiguos con fecha en texto no se tocan). La tienda ve el tiempo restante en cada tarjeta y en la campana.
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
2. En la base: `configuracion.pagos.modo` = `automatico` y precios > 0.
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

El código se guarda en memoria, no en la base: es privado (la base es de lectura abierta) y si el servidor se reinicia, se pide de nuevo. La reglas puras (código, caducidad, intentos, validación) están en `logica.ts` y se prueban solas. `ForgotPassword.vue` solo pide teléfono → código + contraseña nueva; ya no genera ni compara nada.

---

## 10. Administración

- **Cuentas** (`admins/{id}`: `nombre, telefono, password(hash bcrypt), rol, activo, creadoEn, ultimoAcceso`). Roles: `superadmin` y `admin`. El primer administrador se crea con `node scripts/crear-admin.mjs`; los demás desde `/admin/cuentas`.
- Solo un **superadmin** crea, edita, cambia contraseña y activa/desactiva cuentas; un `admin` solo ve la lista. Reglas en `motivoBloqueoCambio`: nadie se desactiva a sí mismo ni se quita el rol de superadmin, y siempre debe quedar al menos un superadmin activo.
- **Un celular, dos accesos**: si el celular con el que entra un cliente (`/login`) también está en `admins/` y activo, tras validar la contraseña de cliente se pregunta "¿Cómo quieres entrar?" (cliente o administrador), en **cada** inicio de sesión. Como administrador se valida la misma contraseña contra el hash del admin; si es distinta se manda a `/admin/login?tel=…` con el celular prellenado. Hoy solo el celular 3751241114 cumple la condición (cliente "Carlos Gaspar" y superadmin "Administrador").
- Tablero: contadores por estatus, tiendas pendientes de aprobación, por vencer en 7 días, avisos "Ya pagué" por confirmar (con campana en `AdminTopbar`) y última corrida de la revisión de membresías.
- Registrar un pago (manual o automático) siempre deja la tienda `activa`: autoriza pendientes y reactiva bloqueadas o vencidas. La vigencia se cuenta desde hoy, o desde la vigencia actual si aún no venció. Historiales en `tiendas/{id}/historialEstatus` y `tiendas/{id}/pagosMembresia`.
- Para **publicar productos** una tienda necesita membresía vigente; una tienda activa sin membresía sigue vendiendo lo ya publicado pero no publica nuevo (guard en `ProductForm` y en el botón ➕ del perfil).
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
| `admin.tiendas.spec.ts`, `admin.categorias.spec.ts`, `configuracion.spec.ts` | Panel de tiendas, categorías y nodo `configuracion` |
| `productForm.spec.ts`, `productCard.spec.ts`, `productosList.spec.ts` | Alta/edición de productos, tarjeta y lista pública |
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
| 2026-09-16 | Compartir con `navigator.share` y lista propia solo de respaldo | La hoja del sistema ya trae WhatsApp y todo lo instalado; mantener una lista fija se desactualiza y se ve ajena al teléfono |
| 2026-09-16 | El enlace a compartir se arma con la ruta, no con `location.href` | Evita compartir `?pago=exito` u otra query del momento |
| 2026-09-16 | El botón de compartir también lo ve la dueña o dueño | Es quien más difunde su propia tienda |
| 2026-09-16 | Compartir vive en la tarjeta del perfil y como círculo flotante en el producto | En el perfil compite con la campana y el corazón del banner; en el producto la columna derecha ya es la de acciones |
| 2026-09-16 | `BotonCompartir` con un solo nodo raíz, sin `inheritAttrs: false` | Con dos raíces (botón + Teleport) el componente no hereda el `data-v-` del padre y sus estilos scoped no aplican, sin error ni aviso |
| 2026-09-16 | El mensaje al compartir un producto no incluye el precio | Cada variante tiene el suyo y cambia; el texto quedaría contradiciendo la pantalla que se abre |
