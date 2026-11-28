# Servicios profesionales (citas y cotizaciones)

Crustore es un marketplace híbrido: una tienda puede vender **productos**, ofrecer **servicios** o ser **mixta**.
Los servicios NO son artículos: tienen su propio modelo, su propio flujo (agendar una cita o pedir una cotización) y no pasan por el carrito.

## Qué está hecho

| Módulo | Estado | Dónde |
|---|---|---|
| 1. Base: tipos, agenda (lógica pura), estados, reglas de la base | ✅ | `src/modules/servicios/`, `database.rules.json` |
| 2. Tipo de negocio al registrar y editar la tienda | ✅ | `StoreRegister.vue`, `StoreEditModal.vue`, `MenuTienda.vue`, `StoreProfile.vue` |
| 3. Perfil profesional, servicios y portafolio | ⏳ | — |
| 4. Agenda: horarios, reservas y citas | ⏳ | — |
| 5. Cotizaciones | ⏳ | — |
| 6. Descubrimiento (portada, directorio) y panel de resumen | ⏳ | — |

## Tipo de negocio

`tiendas/{id}/tipoNegocio`: `productos` | `servicios` | `mixto`.
**Sin el campo (tiendas anteriores) = `productos`**: no hace falta migrar nada (`tipoDeTienda()` en `negocio.ts`).

- Productos: todo como siempre.
- Servicios: sin artículos, pedidos ni carrito; el paso 4 del registro cambia a «Atención y horario» (modalidad y cobertura); su categoría es la de servicios.
- Mixto: las dos cosas.

Campos nuevos de la tienda (solo servicios y mixto): `modalidadAtencion` (`local` | `domicilio` | `ambas`), `categoriaServicio` (id de `CATEGORIAS_SERVICIO`), `especialidades[]`, `experiencia`.
`envioDomicilio` y `zonasEntrega` (los campos que ya usa toda la app) se derivan de la modalidad en una tienda de servicios: las zonas son su **cobertura**.

Si una tienda pasa a «solo servicios», sus artículos viejos **no se borran** pero dejan de mostrarse en el catálogo público (vuelven si regresa a Productos o Mixto).

## Modelo de datos (Firebase Realtime Database)

```
servicios/{tiendaId}/{servicioId}            nombre, descripcion, fotos[], categoria, tipoPrecio, precio, duracionMin,
                                              modalidad, contratacion, profesionalIds[], activo, orden
profesionales/{tiendaId}/{profId}            nombre, fotoUrl, especialidad, activo        (siempre existe "principal")
disponibilidad/{tiendaId}/{profId}           semana{lun..dom}, anticipacionMin, maxDiasAdelante, bloqueos[], vacaciones[]
citas/{tiendaId}/{citaId}                    servicio, profesional, cliente, fecha, inicio, fin, estado, historial
citasPorCliente/{clienteId}/{citaId}         { tiendaId }
ocupacion/{tiendaId}/{profId}/{AAAA-MM-DD}/{HHmm}   citaId   ← un nodo por bloque de 15 min
cotizaciones/{tiendaId}/{cotId}              solicitud, imágenes, respuesta{precio, condiciones, venceEl}, estado, historial
cotizacionesPorCliente/{clienteId}/{cotId}   { tiendaId }
clientesServicio/{tiendaId}/{clienteId}      resumen que se mantiene al reservar o cotizar
```

Los tipos están en `src/modules/servicios/tipos.ts`.

## Cómo se evitan las reservas dobles

1. Cada cita ocupa **bloques de 15 minutos**: `ocupacion/{tienda}/{prof}/{fecha}/{HHmm}`. Una cita de 60 min ocupa 4 bloques.
2. Reservar es **una sola escritura multi-ruta atómica** (`rutasOcupacion()`): la cita + todos sus bloques. Cancelar/rechazar/reprogramar libera los bloques en otra escritura atómica.
3. Las reglas de la base (`database.rules.json`) exigen que un bloque **no exista** al crearlo (`!data.exists()`). Si dos clientes quieren el mismo horario —o uno se cruza con un bloque ya ocupado—, la base rechaza la escritura COMPLETA y el segundo cliente recibe el error (no queda una cita a medias). La validación vive en Firebase, no solo en la pantalla.
4. Antes de escribir, la pantalla vuelve a calcular con la misma lógica (`puedeReservar()`), para avisar bien en el caso normal.

`horariosDelDia()` (lógica pura, 100 % probada) calcula qué horas se pueden reservar: horario del día, descansos, bloqueos, vacaciones, anticipación mínima (60 min por defecto), máximo de días hacia adelante (60) y bloques ocupados. Todo en la zona horaria America/Mexico_City.

## Reglas de la base: qué hacen y cómo publicarlas

`database.rules.json` **no restringe el resto de la base** (sigue abierta como hoy): solo valida los nodos nuevos (formato, estados, duración múltiplo de 15) y pone los índices (`.indexOn`) de citas, cotizaciones y tiendas.

> ⚠️ Las reglas no están en el repositorio desde antes: viven en la consola de Firebase. **Antes de publicar este archivo, revisa las reglas actuales** (Consola › Realtime Database › Reglas). Si tienen algo distinto a `".read": true, ".write": true`, copia solo los bloques de los nodos nuevos (`tiendas`, `servicios`, `profesionales`, `ocupacion`, `citas`, `citasPorCliente`, `cotizaciones`, `cotizacionesPorCliente`, `clientesServicio`) dentro de tus reglas.

Para publicarlas (una de las dos):
- Pegar el contenido en Consola › Realtime Database › Reglas › Publicar.
- O con la CLI: `npx firebase-tools deploy --only database --project mrapp-b8d1e`. El despliegue automático de GitHub **no** las publica (solo despliega Hosting) y su cuenta de servicio necesitaría el permiso «Firebase Rules Admin» para hacerlo.

**Limitación honesta:** Crustore no usa Firebase Auth (la identidad es la sesión del navegador), así que las reglas NO pueden distinguir "dueño" de "cliente" en el servidor: cualquiera que hable directo con la base podría tocar los datos de otra tienda. Lo que sí se garantiza en la base es la integridad (formato, estados válidos) y que **no haya reservas dobles**. Permisos reales por propietario y cliente requieren Firebase Auth con tokens personalizados emitidos por el servidor de Render (gratis); es una fase aparte porque cambia el inicio de sesión de toda la app.

Las reglas no se pueden ejecutar en este entorno (el emulador necesita Java): las pruebas verifican que el archivo es válido, que cada regla de formato acepta las claves que genera la lógica y rechaza las inválidas, y que la regla anti-colisión está presente. Conviene probar las reglas en el simulador de la consola antes de publicarlas.

## Imágenes

Como en el resto de la app, las fotos (portafolio, adjuntos de cotizaciones) se suben a **Cloudinary** (`uploadImage`, gratis), no a Firebase Storage —que hoy exige el plan de pago—. Se reutiliza `eliminarImagenes` (solo borra las que ya nadie usa).
