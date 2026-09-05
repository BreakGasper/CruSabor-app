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
| Correo | Servidor Express + Nodemailer para recuperar contraseña (`src/services/main.ts`) |
| Calidad | [vue-tsc](https://github.com/vuejs/language-tools), [Vitest](https://vitest.dev/) + jsdom + fake-indexeddb + Vue Test Utils |
| Hosting | Firebase Hosting (`dist`) |

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

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con Vite |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run type-check` | Revisa tipos en `.ts` y `.vue` con vue-tsc |
| `npm test` | Corre la suite de Vitest una vez |
| `npm run test:watch` | Vitest en modo interactivo |

Despliegue: `npm run build` y luego `firebase deploy --only hosting`.

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

---

## 📦 Ciclo de vida de un pedido

```
Preparacion ──► Enviado ──► Entregado
     │             │
     └──► Cancelado ◄┘
```

- **Cliente** confirma el pedido desde el checkout. El stock de cada variante se descuenta con una transacción atómica; si algo no alcanza, se revierte y se avisa qué productos faltan.
- **Cliente** puede cancelar solo mientras ninguna tienda haya enviado. El stock regresa.
- **Tienda** avanza sus artículos (Marcar enviado → Marcar entregado) y puede cancelar mientras no estén entregados, con motivo opcional.
- Un pedido puede incluir artículos de varias tiendas: cada una lleva su estatus en `estatusPorTienda` y el `estatus` global se deriva de ellos.
- Cada transición queda en `historial` (estatus, fecha ISO, quién, tienda, nota) y alimenta el seguimiento del cliente y la línea de tiempo de la tienda.
- La pantalla de pedidos de la tienda escucha cambios en vivo (`onValue`), sin recargar.

Toda esta lógica vive en `src/composables/usePedidos.ts`.

---

## 🗂️ Estructura

```
src/
├── components/          ArrowBack, ConfirmModal, CustomToast, CartButton (contador en vivo)
├── composables/         Acceso a Firebase: useAuth, useTiendas, useArticulos, useCategorias, usePedidos
├── db/                  Dexie: esquema (Carrito, Favoritos, TiendasFavoritas) y composables locales
│   └── composables/     useCarrito, useCarritoRapido, useFavoritos, useTiendasFavoritas
├── modules/
│   ├── home/            Flujo del cliente (vistas, componentes, rutas)
│   └── store/           Flujo de la tienda (vistas, componentes, rutas)
├── plugins/             Registro de iconos FontAwesome
├── services/            Servidor Express de correo
├── utils/               sessionUser, sessionPedido, utilidades
└── types/               Producto
tests/                   Vitest: mocks de Firebase y router, pruebas de flujo y de componentes
```

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

---

## ⚠️ Pendientes conocidos

- Reglas de seguridad de Firebase: la base no tiene reglas versionadas en el repo. Agregar reglas por nodo y `".indexOn": ["id_usuario"]` en `pedidos`.
- `FIREBASE_STORAGE_BASE_URL` en `src/constants/firebase_util.ts` debe apuntar a la URL real de imágenes.
- Artículos antiguos no tienen `categoriaId`; la app compara por nombre como respaldo. Conviene migrarlos.
- Carrito y favoritos viven en el navegador; no se sincronizan entre dispositivos.
- Recuperar contraseña solo existe para clientes.
- El repositorio tiene `package-lock.json` y `yarn.lock`; usar solo uno.
