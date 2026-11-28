/** Escenas de fondo con IA: reglas, servidor (con topes) y pantalla. La IA se simula: nunca se llama a Cloudflare. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { mount, flushPromises } from '@vue/test-utils';
import { configDesdeEntorno, crearLimitador, dataUrlDeImagen, limpiarDescripcion, promptDeEscena } from '../src/services/escenas/logica.ts';
import { crearRouterEscenas } from '../src/services/escenas/router.ts';
import { ESTILOS_ESCENA, estadoEscenas, generarEscena, ErrorEscena } from '@/modules/store/utils/escenas';

const ENV_OK = { CLOUDFLARE_ACCOUNT_ID: 'cuenta', CLOUDFLARE_API_TOKEN: 'token' } as any;

describe('reglas', () => {
  it('limpia la descripción y rechaza lo vacío o larguísimo', () => {
    expect(limpiarDescripcion('  mesa   de\nmadera ')).toBe('mesa de madera');
    expect(limpiarDescripcion('ab')).toBeNull();
    expect(limpiarDescripcion('x'.repeat(201))).toBeNull();
    expect(limpiarDescripcion(null)).toBeNull();
  });
  it('el prompt añade las reglas fijas: sin gente ni letras y espacio al centro', () => {
    const p = promptDeEscena('playa');
    expect(p.startsWith('playa, ')).toBe(true);
    for (const t of ['no people', 'no text', 'no logos', 'empty surface in the center']) expect(p).toContain(t);
  });
  it('sin las dos variables de Cloudflare está apagado; los topes tienen valores por defecto y se pueden cambiar', () => {
    expect(configDesdeEntorno({} as any)).toBeNull();
    expect(configDesdeEntorno({ CLOUDFLARE_ACCOUNT_ID: 'a' } as any)).toBeNull();
    expect(configDesdeEntorno(ENV_OK)).toMatchObject({ maxDia: 300, maxPorHoraPorIp: 8 });
    expect(configDesdeEntorno({ ...ENV_OK, ESCENAS_MAX_DIA: '50', ESCENAS_MAX_HORA_IP: '2' })).toMatchObject({ maxDia: 50, maxPorHoraPorIp: 2 });
    expect(configDesdeEntorno({ ...ENV_OK, ESCENAS_MAX_DIA: 'x' })).toMatchObject({ maxDia: 300 });
  });
  it('data URL: PNG o JPEG según los primeros bytes', () => {
    expect(dataUrlDeImagen('iVBORw0KGgo=')).toMatch(/^data:image\/png;base64,/);
    expect(dataUrlDeImagen('/9j/4AAQ')).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe('limitador', () => {
  it('tope por hora y por persona: otra persona no se ve afectada y pasada la hora se libera', () => {
    let t = new Date('2026-11-28T10:00:00Z').getTime();
    const l = crearLimitador(() => new Date(t));
    const cfg = { maxDia: 100, maxPorHoraPorIp: 2 };
    expect(l.intentar('a', cfg).ok).toBe(true);
    expect(l.intentar('a', cfg).ok).toBe(true);
    expect(l.intentar('a', cfg)).toEqual({ ok: false, motivo: 'ip' });
    expect(l.intentar('b', cfg).ok).toBe(true);
    t += 3_700_000;
    expect(l.intentar('a', cfg).ok).toBe(true);
  });
  it('tope diario global, y se reinicia al día siguiente', () => {
    let t = new Date('2026-11-28T10:00:00Z').getTime();
    const l = crearLimitador(() => new Date(t));
    const cfg = { maxDia: 2, maxPorHoraPorIp: 50 };
    l.intentar('a', cfg); l.intentar('b', cfg);
    expect(l.intentar('c', cfg)).toEqual({ ok: false, motivo: 'dia' });
    expect(l.restantes(cfg)).toBe(0);
    t += 24 * 3_600_000;
    expect(l.intentar('c', cfg).ok).toBe(true);
  });
  it('devolver() no gasta el cupo cuando la generación falló', () => {
    const l = crearLimitador();
    const cfg = { maxDia: 1, maxPorHoraPorIp: 5 };
    expect(l.intentar('a', cfg).ok).toBe(true);
    l.devolver('a');
    expect(l.intentar('a', cfg).ok).toBe(true);
  });
});

function levantar(env: any, generar?: any) {
  const app = express();
  app.use(express.json());
  app.use('/escenas', crearRouterEscenas({ env, generar, log: () => {} }));
  const servidor = app.listen(0);
  return { servidor, base: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}` };
}
const post = (base: string, cuerpo: any) => fetch(`${base}/escenas/generar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

describe('servidor /escenas', () => {
  let cerrar: (() => void) | null = null;
  afterEach(() => { cerrar?.(); cerrar = null; });

  it('sin configurar: estado apagado y no genera nada', async () => {
    const generar = vi.fn();
    const { servidor, base } = levantar({}, generar);
    cerrar = () => servidor.close();
    expect(await (await fetch(`${base}/escenas/estado`)).json()).toEqual({ activo: false, restantesHoy: 0 });
    const r = await post(base, { descripcion: 'playa soleada' });
    expect(await r.json()).toMatchObject({ activo: false });
    expect(generar).not.toHaveBeenCalled();
  });

  it('genera: el modelo recibe el prompt con las reglas fijas y la app recibe la imagen', async () => {
    const generar = vi.fn(async () => 'iVBORw0KGgo=');
    const { servidor, base } = levantar(ENV_OK, generar);
    cerrar = () => servidor.close();
    expect(await (await fetch(`${base}/escenas/estado`)).json()).toEqual({ activo: true, restantesHoy: 300 });
    const r = await post(base, { descripcion: 'mesa de madera' });
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.imagen).toMatch(/^data:image\/png;base64,/);
    expect(d.restantesHoy).toBe(299);
    expect((generar.mock.calls[0] as any[])[0]).toContain('mesa de madera');
    expect((generar.mock.calls[0] as any[])[0]).toContain('no people');
  });

  it('rechaza una descripción inválida sin gastar cupo ni llamar a la IA', async () => {
    const generar = vi.fn();
    const { servidor, base } = levantar(ENV_OK, generar);
    cerrar = () => servidor.close();
    const r = await post(base, { descripcion: 'a' });
    expect(r.status).toBe(400);
    expect(generar).not.toHaveBeenCalled();
    expect((await (await fetch(`${base}/escenas/estado`)).json()).restantesHoy).toBe(300);
  });

  it('el tope por persona responde 429 con un mensaje claro', async () => {
    const { servidor, base } = levantar({ ...ENV_OK, ESCENAS_MAX_HORA_IP: '2' }, async () => '/9j/AA==');
    cerrar = () => servidor.close();
    expect((await post(base, { descripcion: 'playa soleada' })).status).toBe(200);
    expect((await post(base, { descripcion: 'playa soleada' })).status).toBe(200);
    const r = await post(base, { descripcion: 'playa soleada' });
    expect(r.status).toBe(429);
    expect((await r.json()).mensaje).toMatch(/Espera un rato/);
  });

  it('si la IA falla responde 502, no revela detalles y no gasta el cupo', async () => {
    const { servidor, base } = levantar(ENV_OK, async () => { throw new Error('token secreto inválido'); });
    cerrar = () => servidor.close();
    const r = await post(base, { descripcion: 'playa soleada' });
    expect(r.status).toBe(502);
    const texto = JSON.stringify(await r.json());
    expect(texto).not.toContain('secreto');
    expect((await (await fetch(`${base}/escenas/estado`)).json()).restantesHoy).toBe(300);
  });
});

describe('cliente', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('estadoEscenas: apagado si el servidor no responde (nunca lanza)', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('sin red'); }) as any;
    expect(await estadoEscenas()).toEqual({ activo: false, restantesHoy: 0 });
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ activo: true, restantesHoy: 12 }) })) as any;
    expect(await estadoEscenas()).toEqual({ activo: true, restantesHoy: 12 });
  });

  it('generarEscena: traduce los errores del servidor a mensajes para mostrar', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ mensaje: 'Por hoy ya se generaron todas.' }) })) as any;
    await expect(generarEscena('playa')).rejects.toThrow('Por hoy ya se generaron todas.');
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ activo: false }) })) as any;
    await expect(generarEscena('playa')).rejects.toThrow(/todavía no están activadas/);
    globalThis.fetch = vi.fn(async () => { throw new Error('x'); }) as any;
    await expect(generarEscena('playa')).rejects.toBeInstanceOf(ErrorEscena);
  });

  it('los estilos traen una descripción para la IA', () => {
    expect(ESTILOS_ESCENA.length).toBeGreaterThanOrEqual(6);
    for (const e of ESTILOS_ESCENA) expect(e.descripcion.length).toBeGreaterThan(10);
  });
});

describe('pantalla Crear publicación', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(async () => {
    const { __reset } = await import('./mocks/firebaseDb');
    const { routeMock } = await import('./setup');
    __reset({});
    routeMock.params = { id: 'T1' };
    localStorage.setItem('tiendas', JSON.stringify({ id: 'T1', nombreTienda: 'Crustore' }));
  });
  afterEach(() => { globalThis.fetch = originalFetch; localStorage.clear(); });

  const montar = async () => {
    const { default: CrearPublicacion } = await import('@/modules/store/views/CrearPublicacion.vue');
    const w = mount(CrearPublicacion, { global: { stubs: { PageHeader: true } } });
    await flushPromises();
    await flushPromises();
    return w;
  };

  it('si la IA no está conectada, la sección de escenas no aparece', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ activo: false, restantesHoy: 0 }) })) as any;
    const w = await montar();
    expect(w.find('[data-testid="seccion-escena"]').exists()).toBe(false);
    w.unmount();
  });

  it('si está conectada, ofrece los estilos y pide la foto antes de inventar', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ activo: true, restantesHoy: 120 }) })) as any;
    const w = await montar();
    expect(w.find('[data-testid="seccion-escena"]').exists()).toBe(true);
    expect(w.findAll('[data-testid^="estilo-"]')).toHaveLength(ESTILOS_ESCENA.length);
    expect(w.text()).toContain('Quedan 120 escenas');
    await w.find('[data-testid="inventar-escena"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="aviso-escena"]').text()).toMatch(/Sube primero la foto/);
    expect((globalThis.fetch as any).mock.calls.every((c: any[]) => String(c[0]).includes('/escenas/estado'))).toBe(true); // no pidió ninguna escena
    w.unmount();
  });
});
