/**
 * Datos de prueba para llenar formularios con el botón "Llenar con datos de prueba".
 *
 * SOLO DESARROLLO: este archivo se carga con `import()` dentro de un
 * `if (import.meta.env.DEV)`, así que Vite lo deja fuera del build de producción
 * (`npm run build`). Nunca lo importes de forma directa.
 *
 * Ojo: en local la app usa la base de Firebase del `.env`. Si esa es la real,
 * lo que registres con estos datos queda en producción. Por eso todo lleva
 * "[Prueba]" en el nombre y correos @example.com: fácil de encontrar y borrar.
 */

const azar = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const elegir = <T>(lista: readonly T[]): T => lista[azar(0, lista.length - 1)];
const sufijo = () => Math.random().toString(36).slice(2, 6);

/** 10 dígitos, distinto cada vez (el registro rechaza teléfonos repetidos) */
export const telefonoPrueba = () => '33' + String(azar(0, 99_999_999)).padStart(8, '0');
export const correoPrueba = (quien = 'prueba') => `${quien}.${sufijo()}@example.com`;
/** Cumple la regla de 6 a 10 caracteres */
export const PASSWORD_PRUEBA = 'Prueba123';

const NOMBRES = ['Ana', 'Luis', 'María', 'Jorge', 'Sofía', 'Carlos', 'Lupita', 'Miguel'] as const;
const APELLIDOS = ['García', 'López', 'Hernández', 'Martínez', 'Ramírez', 'Torres'] as const;
const TIENDAS = ['Postres Lola', 'Tacos El Güero', 'Abarrotes Don Pepe', 'Panadería La Espiga', 'Florería Rosa'] as const;
const CALLES = ['Av. Juárez', 'Hidalgo', 'Morelos', 'Independencia', 'Av. Vallarta', 'Allende'] as const;

export const nombrePersonaPrueba = () => `${elegir(NOMBRES)} ${elegir(APELLIDOS)} [Prueba]`;
export const nombreTiendaPrueba = () => `${elegir(TIENDAS)} [Prueba ${sufijo()}]`;
export const callePrueba = () => elegir(CALLES);
export const numeroPrueba = () => String(azar(1, 999));

/** Fecha de nacimiento AAAA-MM-DD de alguien entre 20 y 50 años */
export function fechaNacimientoPrueba(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - azar(20, 50), azar(0, 11), azar(1, 28));
  return d.toISOString().slice(0, 10);
}

/**
 * Imagen PNG dibujada al vuelo (cuadro de color con texto), para los campos que
 * exigen foto (logo de tienda, imagen de producto). Necesita un navegador.
 */
export function imagenPrueba(texto: string, nombreArchivo = 'prueba.png', lado = 400): Promise<File> {
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  if (ctx) {
    const tono = azar(0, 360);
    ctx.fillStyle = `hsl(${tono} 65% 45%)`;
    ctx.fillRect(0, 0, lado, lado);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(lado / 6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto.slice(0, 10), lado / 2, lado / 2);
    ctx.font = `${Math.round(lado / 14)}px sans-serif`;
    ctx.fillText('PRUEBA', lado / 2, lado * 0.72);
  }
  return new Promise((resolve, reject) => {
    lienzo.toBlob((blob) => {
      if (!blob) return reject(new Error('No se pudo dibujar la imagen de prueba'));
      resolve(new File([blob], nombreArchivo, { type: 'image/png' }));
    }, 'image/png');
  });
}

const PRODUCTOS = [
  { nombre: 'Chocoflán de la casa', descripcion: 'Rebanada de chocoflán casero con cajeta, hecho el mismo día.', precio: 45 },
  { nombre: 'Tamales de rajas', descripcion: 'Docena de tamales de rajas con queso, envueltos en hoja de maíz.', precio: 180 },
  { nombre: 'Pan de muerto', descripcion: 'Pan de muerto tradicional con azúcar, tamaño mediano.', precio: 35 },
  { nombre: 'Agua de horchata 1 L', descripcion: 'Agua fresca de horchata con canela, botella de un litro.', precio: 30 },
] as const;

export const productoPrueba = () => {
  const p = elegir(PRODUCTOS);
  return { ...p, nombre: `${p.nombre} [Prueba]` };
};
