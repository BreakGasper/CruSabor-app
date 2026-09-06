# 🛍️ CruSabor App (MAVI Store)

Marketplace web con dos caras: la **tienda en línea** para clientes y el **panel de tiendas** para negocios que publican productos y atienden pedidos.

Construida con **Vue 3 + TypeScript + Vite**, **Firebase Realtime Database** como backend y **Dexie (IndexedDB)** para carrito y favoritos en el navegador. Diseño adaptable a móvil, tablet y escritorio.

---

## 🚀 Tecnologías

| Área | Herramienta |
| --- | --- |
| UI | [Vue 3](https://vuejs.org/) (script setup), [Vue Router](https://router.vuejs.org/), [Pinia](https://pinia.vuejs.org/), [PrimeVue](https://primevue.org/), [SweetAlert2](https://sweetalert2.github.io/) |
| Iconos | [FontAwesome](https://fontawesome.com/) y [Lucide](https://lucide.dev/) |
| Datos | [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) (usuarios, tiendas, artículos, categorías, pedidos) |
| Local | [Dexie](https://dexie.org/) sobre IndexedDB (carrito, favoritos, tiendas favoritas) |
| Imágenes | Cloudinary / Firebase Storage |
| Servidor | Express (`src/services/main.ts`): correo de recuperación con Nodemailer y pagos de membresía con Mercado Pago. Publicado en Render (`render.yaml`) |
| Pagos | [Mercado Pago Checkout Pro](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/landing) vía API REST con `fetch` (sin SDK), webhook firmado |
| Calidad | [vue-tsc](https://github.com/vuejs/language-tools), [Vitest](https://vitest.dev/) + jsdom + fake-indexeddb + Vue Test Utils |
| Hosting | App: Firebase Hosting (`dist`) → https://mrapp-b8d1e.web.app · API: Render → https://mavi-api.onrender.com |

---

## 📦 Instalación y scripts

```bash
git clone https://github.com/BreakGasper/CruSabor-app.git
cd CruSabor-app
npm install
```

Crea un archivo `.env` en la raíz (no lo subas al repositorio):

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

Los secretos van en `.env.local` (ignorado por git, tiene prioridad sobre `.env`; lo leen Vite y el servidor):

```env
MP_ACCESS_TOKEN=TEST-...            # Access Token de Mercado Pago (TEST- pruebas / APP_USR- producción)
MP_WEBHOOK_SECRET=                  # clave del webhook (Mercado Pago › Tus integraciones › Webhooks)
API_PUBLIC_URL=https://mavi-api.onrender.com   # URL pública https del servidor Express
FRONTEND_URL=https://mrapp-b8d1e.web.app
FIREBASE_SERVICE_ACCOUNT_JSON=      # opcional: cuenta de servicio en una línea (firebase-admin)
VITE_API_URL=http://localhost:3000  # a dónde llama la app; al compilar para producción debe ser la URL de Render
```

`render.env.local` tiene el mismo contenido preparado para pegarse en Render › Environment › "Add from .env".

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con Vite |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run type-check` | Revisa tipos en `.ts` y `.vue` con vue-tsc |
| `npm test` | Corre la suite de Vitest una vez |
| `npm run test:watch` | Vitest en modo interactivo |
| `npm run server` | Servidor Express local en el puerto 3000 (correo + pagos) |

Despliegue de la app: `npm run build` (con `VITE_API_URL` apuntando a Render) y luego `firebase deploy --only hosting`.
Despliegue del servidor: Render hace `autoDeploy` con cada push a `main` (blueprint en `render.yaml`, health check `/salud`).

---

## 🧭 Rutas principales

**Cliente**

| Ruta | Pantalla |
| --- | --- |
| `/` | Home: buscador, carrusel, productos, menú lateral |
| `/producto/:id` | Detalle de producto, variantes, agregar al carrito |
| `/categoria` | Categorías con buscador y conteo de productos |
| `/categoriaArticulos/:id/:nombre` | Productos de una categoría |
| `/tiendas` | Directorio de tiendas con buscador, filtros y favoritas |
| `/cart` → `/checkout` | Carrito y confirmación en 3 pasos (domicilio, pago, resumen) |
| `/pedidos`, `/pedido/:id` | Mis pedidos y seguimiento con historial y cancelación |
| `/favoritos`, `/perfil` | Favoritos y perfil (datos, compras, favoritos, tiendas favoritas, configuración) |
| `/login`, `/register` | Acceso y registro de clientes |

**Tienda**

| Ruta | Pantalla |
| --- | --- |
| `/store/login`, `/store/register` | Acceso y registro de tiendas (asistente de 5 pasos) |
| `/store/profile/:id?` | Perfil público de la tienda con sus productos |
| `/store/articles/:id` | Catálogo de la tienda (clientes pueden agregar al carrito) |
| `/store/products/:id`, `/store/product/edit/:articuloId` | Alta y edición de productos |
| `/store/pedidos/:id_tienda` | Gestión de pedidos en tiempo real |

**Administrador** (login propio sin Firebase Auth, ver `useAdmin.ts`)

| Ruta | Pantalla |
| --- | --- |
| `/admin/tiendas`, `/admin/tiendas/:id` | Tiendas: estatus, membresías, registrar pagos manuales, historial |
| `/admin/categorias` | Catálogo de categorías |
| `/admin/configuracion` | Nodo `configuracion`: precios de membresía, modo de pago, mantenimiento, registro |

---

## 📦 Ciclo de vida de un pedido

```
Preparacion ──► Atendiendo ──► Enviado ──► Entregado
     │              │            │
     └──────────► Cancelado ◄────┘
```

- **Cliente** confirma el pedido desde el checkout. El stock de cada variante se descuenta con una transacción atómica; si algo no alcanza, se revierte y se avisa qué productos faltan.
- **Cliente** puede cancelar solo mientras ninguna tienda haya empezado a atender ni enviado. El stock regresa.
- **Tienda** avanza sus artículos (Atender → Marcar enviado → Marcar entregado; puede saltar directo a enviado) y puede cancelar mientras no estén entregados. Al cancelar el motivo es obligatorio.
- **Atendiendo**: la tienda confirma que ya está preparando el pedido. El cliente ve "Atendiendo tu pedido" y ya no puede cancelar; el reloj de cancelación automática se detiene. Para la tienda, `Preparacion` se muestra como "Nuevo · sin atender" (`ESTATUS_LABEL_TIENDA`).
- **Motivo de cancelación**: `motivoCancelacion(pedido, tiendaId?)` saca del historial quién canceló y la nota; `textoCancelacion(m, 'cliente' | 'tienda')` lo redacta para cada lector ("Cancelado por la tienda: …", "Cancelaste este pedido: …", o el texto automático). Se muestra en la lista y el detalle del cliente y en la tarjeta de la tienda, también cuando solo una tienda del pedido canceló (`cancelacionesPorTienda`).
- **Productos bajo pedido** (`articulos/{id}/porPedido === true`, casilla en el formulario de producto): la tienda los elabora cuando el cliente los pide, así que no controlan stock (el carrito rápido y el detalle los tratan como ilimitados) y llevan la etiqueta "Bajo pedido". La marca viaja en el carrito y en `items[].porPedido` del pedido; el cliente ve "tus artículos bajo pedido se están elaborando" cuando la tienda atiende.
- Un pedido puede incluir artículos de varias tiendas: cada una lleva su estatus en `estatusPorTienda` y el `estatus` global se deriva de ellos.
- Cada transición queda en `historial` (estatus, fecha ISO, quién, tienda, nota) y alimenta el seguimiento del cliente y la línea de tiempo de la tienda.
- La pantalla de pedidos de la tienda escucha cambios en vivo (`onValue`), sin recargar.
- **Carrito agrupado por tienda** (`CartView.vue`): los artículos se muestran en un bloque por tienda con su nombre (enlace al perfil), cantidad, subtotal y estado abierta/cerrada.
- **Nombre de la tienda**: la fuente de verdad es `tiendas/{id}/nombreTienda`. Artículos (`tiendaNombre`), carrito (`nombre_tienda`) y pedidos (`items[].nombreTienda`) solo guardan una copia. Al renombrar desde el perfil, `actualizarTienda` la propaga a todos sus artículos; el catálogo (`useArticulos`) y el carrito muestran siempre el nombre vivo vía `useEstadoTiendas().nombreDe`. Los pedidos conservan el nombre histórico a propósito. Para reparar copias viejas: `node scripts/sincronizar-nombre-tienda.mjs --apply`.
- **Horario de la tienda** (`src/composables/useHorarioTienda.ts`): los productos de una tienda cerrada se pueden guardar en el carrito, pero no comprar. El carrito los marca, los excluye del total y manda al checkout solo los de tiendas abiertas; `guardarPedidos` vuelve a validar y lanza `TiendaCerradaError`. Tras comprar, solo salen del carrito los artículos comprados. Una tienda sin horario registrado cuenta como abierta. La hora se evalúa en `America/Mexico_City`.
- **Cancelación automática** (`HORAS_LIMITE_ATENCION = 2`): si una tienda no atiende ni marca "enviado" en 2 h desde la creación (sigue en `Preparacion`), el sistema cancela su parte del pedido (historial `por: 'sistema'`, `canceladoPor: 'sistema'` si era la única) y devuelve su stock. Se ejecuta al leer pedidos (cliente y tienda) con una transacción sobre el pedido para no repetir la cancelación. Solo aplica a pedidos con `fecha_creacion` ISO. La tienda ve el tiempo restante en cada tarjeta.

Toda esta lógica vive en `src/composables/usePedidos.ts`.

---

## 💳 Membresías y pago con Mercado Pago

Las tiendas pagan una membresía (`mensual` o `anual`) para vender. El campo de la tienda se llama `estatus` (`pendiente | activa | bloqueada | vencida`); el estado efectivo se calcula con `membresia.vigenteHasta` y `configuracion.membresia.diasGracia`.

**Dos modos**, elegidos en `configuracion.pagos.modo` (panel admin › Configuración):

| Modo | Flujo |
| --- | --- |
| `manual` | La tienda abre `linkMensual`/`linkAnual` (links del panel de Mercado Pago), paga y pulsa "Ya pagué" → crea una solicitud en `solicitudesPago` que el administrador confirma con "Registrar pago" (`useSolicitudesPago.ts`, `useAdminTiendas.ts`) |
| `automatico` | La app pide al servidor una preferencia de Checkout Pro, redirige a Mercado Pago y el **webhook** activa la membresía solo, sin intervención del admin |

**Flujo automático paso a paso**

1. `StoreProfile.vue` → `iniciarPagoMembresia()` (`useMercadoPago.ts`) hace `POST {VITE_API_URL}/pagos/membresia/crear { tiendaId, plan, origen }`.
2. `router.ts` valida que `pagos.modo === 'automatico'` y que haya precio, crea la preferencia con `external_reference = membresia|tiendaId|plan|intentoId`, guarda `pagosMercadoPago/{intentoId}` en estado `pendiente` y devuelve `init_point`.
3. La tienda paga. Mercado Pago regresa a `/store/profile/:id?pago=exito|pendiente|error` (solo aviso visual) y avisa al servidor en `POST /pagos/membresia/webhook`.
4. El webhook valida la firma `x-signature` con `MP_WEBHOOK_SECRET`, consulta `/v1/payments/{id}` y, si está `approved` y el monto alcanza, aplica `cambiosParaPagoAprobado()` (`logicaPago.ts`): registra el pago en `tiendas/{id}/pagosMembresia`, extiende `membresia.vigenteHasta`, pone la tienda en `activa` y marca el intento como `aprobado`. Deja exactamente los mismos datos que un pago manual del admin.
5. `GET /pagos/membresia/estado` dice si el servidor tiene las variables necesarias (`activo`, `faltan`).

Archivos del servidor: `src/services/pagos/{router,logicaPago,mercadoPagoApi,almacen}.ts`. `almacen.ts` escribe en Realtime Database con firebase-admin si hay cuenta de servicio, o por la API REST si no.

**Cómo probar un pago simulado (checklist)**

1. `curl https://mavi-api.onrender.com/pagos/membresia/estado` → debe dar `{"activo":true}`. Render gratuito se duerme: la primera llamada puede tardar ~1 min.
2. En Realtime Database `configuracion.pagos.modo` = `automatico` y `configuracion.membresia.precioMensual/precioAnual` > 0.
3. `MP_ACCESS_TOKEN` en Render debe ser el de **pruebas** (`TEST-`). Verificar con `curl -H "Authorization: Bearer $TOKEN" https://api.mercadopago.com/users/me`.
4. En Mercado Pago › Tus integraciones › Webhooks (modo pruebas) debe estar registrada `https://mavi-api.onrender.com/pagos/membresia/webhook` con el evento **Pagos**, y su clave secreta debe coincidir con `MP_WEBHOOK_SECRET`.
5. Entrar a la app publicada con una tienda → perfil → "Ir a pagar" → elegir plan. En el checkout usar un **usuario comprador de prueba** (con token `TEST-` una cuenta real no puede pagar) y tarjeta de prueba, p. ej. Visa `4075 5957 1648 3764`, CVV `123`, titular `APRO` (aprobado) u `OTHE` (rechazado).
6. Resultado esperado: aviso "¡Pago recibido!", la tienda queda `activa` con `membresia.vigenteHasta` extendido y `pagosMercadoPago/{intentoId}.estado === 'aprobado'`.
7. Para depurar: logs del servicio en Render ("Pago de membresía aprobado" / "Webhook ... firma inválida" / "pago no encontrado"). La prueba del simulador de webhooks de MP responde 200 con `ignorado` porque ese pago no existe.

**Salir a producción**: cambiar `MP_ACCESS_TOKEN` por el `APP_USR-...` y `MP_WEBHOOK_SECRET` por la clave del webhook de producción en Render; registrar el webhook de producción con la misma URL; llenar `FIREBASE_SERVICE_ACCOUNT_JSON`.

---

## 🗂️ Estructura

```
src/
├── components/          ArrowBack, ConfirmModal, CustomToast, CartButton (contador en vivo)
├── composables/         Acceso a Firebase: useAuth, useTiendas, useArticulos, useCategorias, usePedidos,
│                        useMembresia, useMercadoPago, useSolicitudesPago, useConfiguracion, useAdmin*
├── db/                  Dexie: esquema (Carrito, Favoritos, TiendasFavoritas) y composables locales
│   └── composables/     useCarrito, useCarritoRapido, useFavoritos, useTiendasFavoritas
├── modules/
│   ├── home/            Flujo del cliente (vistas, componentes, rutas)
│   ├── store/           Flujo de la tienda (vistas, componentes, rutas)
│   └── admin/           Panel del administrador (tiendas, categorías, configuración)
├── plugins/             Registro de iconos FontAwesome
├── services/            Servidor Express: main.ts (correo) y pagos/ (Mercado Pago: router, logicaPago, mercadoPagoApi, almacen)
├── utils/               sessionUser, sessionPedido, utilidades
└── types/               Producto
tests/                   Vitest: mocks de Firebase y router, pruebas de flujo y de componentes
```

### Deslizar para actualizar (móvil)

`src/components/PullToRefresh.vue` envuelve el `router-view` en `App.vue`. En pantalla táctil, si la página y el contenedor bajo el dedo están arriba del todo y se arrastra hacia abajo más de 70 px, emite `refresh`; `App.vue` incrementa la `key` del `router-view`, con lo que la vista se desmonta y vuelve a montar y repite sus cargas de `onMounted`. No recarga la página ni toca sesión o carrito local. Funciona en todas las pantallas sin código por vista. Existe porque `overscroll-behavior: contain` desactiva el gesto nativo del navegador y en modo PWA no hay botón de recargar.

### Tema claro y oscuro

La app sigue la preferencia del sistema (`color-scheme: light dark`). Los colores viven en `src/assets/styles/ColorsVarCss.css` como tokens semánticos con variante clara y oscura: `--bg-page`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--border`, y para texto en color de marca `--brand-navy-text` / `--brand-blue-text`. Regla al escribir estilos: no usar `white`, `#fff`, `#333`, `#666`, `#ccc`… para fondos, texto o bordes; usar los tokens. Los badges de estado (fondo pastel + texto oscuro fijados juntos) sí pueden llevar colores fijos porque se leen en ambos modos. `src/style.css` da a inputs, selects y textareas el fondo y color del tema para que el navegador no los pinte oscuros con texto invisible.

### Sesiones

Cliente y tienda usan sesiones distintas guardadas en `localStorage` (`usuario` y `tiendas`). Iniciar sesión en una cierra la otra.

---

## 🧪 Pruebas

```bash
npm test
```

La suite corre sin tocar Firebase real: `tests/mocks/firebaseDb.ts` es un Firebase en memoria (`get`, `set`, `update`, `push`, `query`, `onValue`, `runTransaction`) y Dexie usa `fake-indexeddb`.

| Archivo | Cubre |
| --- | --- |
| `tests/pedidos.flujo.spec.ts` | Reglas del ciclo de pedidos desde cliente y tienda: creación, stock, cancelaciones, transiciones, pedidos antiguos |
| `tests/pedidos.componentes.spec.ts` | `StorePedidos` y `PedidoDetalle` montados: clics reales en enviar, entregar y cancelar, filtros, actualización en vivo |
| `tests/carrito.cliente.spec.ts` | Carrito rápido con límites de stock, tiendas favoritas, contador de `CartButton` |
| `tests/cartview.navegacion.spec.ts` | Regresión: el estado enviado a `/checkout` debe ser clonable (evita recarga completa) |
| `tests/horarioTienda.spec.ts` | Horario: regla pura (días, cierre exclusivo, medianoche, próxima apertura), mapa compartido y candado al guardar el pedido |
| `tests/atenderPedido.spec.ts` | Estatus Atendiendo (transiciones, global, detiene el reloj), motivos de cancelación para cliente y tienda, artículos bajo pedido |
| `tests/pedidosSinAtender.spec.ts` | Cancelación automática a las 2 h: tiempo restante, cancelación parcial/total por sistema, devolución de stock, expiración al leer |
| `tests/pagoAutomatico.spec.ts` | Servidor de pagos: creación de preferencia, firma del webhook, activación de membresía con Mercado Pago simulado |
| `tests/solicitudesPago.spec.ts`, `tests/membresia.spec.ts`, `tests/vencimientos.spec.ts` | Modo manual, cálculo de vigencias y vencimientos |
| `tests/admin.*.spec.ts`, `tests/configuracion.spec.ts` | Panel de administrador y nodo `configuracion` |

---

## ⚠️ Pendientes conocidos

- Reglas de seguridad de Firebase: la base no tiene reglas versionadas en el repo. Agregar reglas por nodo y `".indexOn": ["id_usuario"]` en `pedidos`.
- `FIREBASE_STORAGE_BASE_URL` en `src/constants/firebase_util.ts` debe apuntar a la URL real de imágenes.
- Artículos antiguos no tienen `categoriaId`; la app compara por nombre como respaldo. Conviene migrarlos.
- Carrito y favoritos viven en el navegador; no se sincronizan entre dispositivos.
- Recuperar contraseña solo existe para clientes.
- `FIREBASE_SERVICE_ACCOUNT_JSON` sigue vacío en Render: el servidor escribe en la base por la API REST abierta. Llenarlo antes de producción.
- Las credenciales de Mercado Pago en Render son de prueba (`TEST-`).
- El repositorio tiene `package-lock.json` y `yarn.lock`; usar solo uno.
