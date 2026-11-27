/**
 * La app instalada en el iPhone debe traer siempre lo último publicado: HTML sin caché, /version.json por
 * compilación, recarga que primero refresca el HTML guardado, y aviso o recarga solo al haber versión nueva.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AvisoActualizacion from '@/components/AvisoActualizacion.vue';
import {
  BUILD_ID, hayVersionNueva, marcarRecargaPorVersion, puedeRecargarPorVersion, recargarConLoNuevo, sePuedeRecargarSolo, vigilarVersion,
} from '@/utils/actualizacion';

const respuesta = (cuerpo: any, ok = true) => ({ ok, json: async () => cuerpo }) as any;

describe('hayVersionNueva', () => {
  it('es verdadero solo si /version.json trae un id distinto al de la versión que corre', async () => {
    const consultar = vi.fn(async () => respuesta({ id: 'bbb' }));
    expect(await hayVersionNueva(consultar as any, 'aaa')).toBe(true);
    expect(await hayVersionNueva((async () => respuesta({ id: 'aaa' })) as any, 'aaa')).toBe(false);
    // se pide sin usar la caché y con un parámetro que cambia cada vez
    const [url, init] = consultar.mock.calls[0] as any[];
    expect(url).toMatch(/^\/version\.json\?_=\d+$/);
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('cualquier fallo cuenta como "nada nuevo": sin red, 404, respuesta que no es JSON o sin id', async () => {
    expect(await hayVersionNueva((async () => { throw new Error('sin red'); }) as any, 'aaa')).toBe(false);
    expect(await hayVersionNueva((async () => respuesta({}, false)) as any, 'aaa')).toBe(false);
    expect(await hayVersionNueva((async () => ({ ok: true, json: async () => { throw new Error('no es json'); } })) as any, 'aaa')).toBe(false);
    expect(await hayVersionNueva((async () => respuesta({})) as any, 'aaa')).toBe(false);
    expect(await hayVersionNueva((async () => respuesta({ id: '' })) as any, 'aaa')).toBe(false);
  });

  it('en desarrollo ("dev") nunca avisa', async () => {
    const consultar = vi.fn(async () => respuesta({ id: 'xyz' }));
    expect(await hayVersionNueva(consultar as any, 'dev')).toBe(false);
    expect(consultar).not.toHaveBeenCalled();
    expect(typeof BUILD_ID).toBe('string');
  });
});

describe('recargarConLoNuevo', () => {
  it('primero vuelve a pedir el HTML ignorando la caché y DESPUÉS recarga', async () => {
    const orden: string[] = [];
    const consultar = vi.fn(async (url: string, init: any) => { orden.push(`pide ${url} ${init.cache}`); return respuesta({}); });
    await recargarConLoNuevo({ consultar: consultar as any, recargar: () => orden.push('recarga') });
    expect(orden.at(-1)).toBe('recarga');
    expect(orden.filter((o) => o.startsWith('pide'))).toHaveLength(2);
    expect(orden.some((o) => o === 'pide /index.html reload')).toBe(true);
    expect(orden.slice(0, -1).every((o) => o.endsWith('reload'))).toBe(true);
  });

  it('si no hay red igual recarga', async () => {
    const recargar = vi.fn();
    await recargarConLoNuevo({ consultar: (async () => { throw new Error('sin red'); }) as any, recargar });
    expect(recargar).toHaveBeenCalledTimes(1);
  });
});

describe('seguridad al recargar solo', () => {
  afterEach(() => { document.body.innerHTML = ''; (document.activeElement as HTMLElement | null)?.blur?.(); });

  it('no recarga solo con un formulario a medias ni escribiendo en un campo', () => {
    expect(sePuedeRecargarSolo()).toBe(true);
    document.body.innerHTML = '<div data-sin-recarga></div>';
    expect(sePuedeRecargarSolo()).toBe(false);
    document.body.innerHTML = '<input id="x">';
    (document.getElementById('x') as HTMLInputElement).focus();
    expect(sePuedeRecargarSolo()).toBe(false);
  });

  it('no entra en un ciclo: tras recargar por versión espera un minuto', () => {
    const memoria: Record<string, string> = {};
    const almacen = { getItem: (k: string) => memoria[k] ?? null, setItem: (k: string, v: string) => { memoria[k] = v; } };
    expect(puedeRecargarPorVersion(1_000_000, almacen)).toBe(true);
    marcarRecargaPorVersion(1_000_000, almacen);
    expect(puedeRecargarPorVersion(1_030_000, almacen)).toBe(false);
    expect(puedeRecargarPorVersion(1_061_000, almacen)).toBe(true);
  });
});

describe('vigilarVersion', () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  const montar = (id: string, extra: Record<string, any> = {}) => {
    const recargar = vi.fn();
    const alHaberNueva = vi.fn();
    const consultar = vi.fn(async () => respuesta({ id }));
    const dejar = vigilarVersion({ alHaberNueva, recargar, consultar: consultar as any, actual: 'aaa', ...extra });
    return { recargar, alHaberNueva, consultar, dejar };
  };

  it('al abrir, con versión nueva y sin formularios, recarga sola (una vez)', async () => {
    const v = montar('bbb');
    await vi.advanceTimersByTimeAsync(2600);
    expect(v.recargar).toHaveBeenCalledTimes(1);
    expect(v.alHaberNueva).not.toHaveBeenCalled();
    v.dejar();
  });

  it('con un formulario a medias no recarga: avisa para que la persona decida', async () => {
    document.body.innerHTML = '<div data-sin-recarga></div>';
    const v = montar('bbb');
    await vi.advanceTimersByTimeAsync(2600);
    expect(v.recargar).not.toHaveBeenCalled();
    expect(v.alHaberNueva).toHaveBeenCalledTimes(1);
    v.dejar();
  });

  it('si la versión es la misma, no hace nada', async () => {
    const v = montar('aaa');
    await vi.advanceTimersByTimeAsync(2600);
    expect(v.recargar).not.toHaveBeenCalled();
    expect(v.alHaberNueva).not.toHaveBeenCalled();
    v.dejar();
  });

  it('revisa también al volver a la app (visibilitychange) y al reconectarse (online)', async () => {
    const v = montar('aaa');
    await vi.advanceTimersByTimeAsync(2600);
    const antes = v.consultar.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);
    expect(v.consultar.mock.calls.length).toBe(antes + 2);
    v.dejar();
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10);
    expect(v.consultar.mock.calls.length).toBe(antes + 2); // ya no vigila
  });

  it('tras una recarga por versión no vuelve a recargar de inmediato aunque la red siga sirviendo la vieja', async () => {
    const v = montar('bbb');
    await vi.advanceTimersByTimeAsync(2600);
    expect(v.recargar).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);
    expect(v.recargar).toHaveBeenCalledTimes(1);
    expect(v.alHaberNueva).toHaveBeenCalledTimes(1); // en su lugar, solo avisa
    v.dejar();
  });
});

describe('aviso de versión nueva', () => {
  it('ofrece Actualizar y cerrar', async () => {
    const w = mount(AvisoActualizacion);
    expect(w.text()).toContain('Hay una versión nueva');
    await w.find('[data-testid="actualizar-ahora"]').trigger('click');
    await w.find('.despues').trigger('click');
    expect(w.emitted('actualizar')).toHaveLength(1);
    expect(w.emitted('cerrar')).toHaveLength(1);
  });
});

describe('Firebase Hosting: caché', () => {
  const hosting = JSON.parse(readFileSync(resolve(__dirname, '../firebase.json'), 'utf8')).hosting;

  it('el HTML y todo lo demás no se guardan (no-cache), solo /assets/** (con hash) se guarda un año', () => {
    const regla = (src: string) => hosting.headers.find((h: any) => h.source === src);
    expect(regla('**').headers).toEqual([{ key: 'Cache-Control', value: 'no-cache' }]);
    expect(regla('/assets/**').headers[0].value).toMatch(/max-age=31536000.*immutable/);
    // la regla específica va después de la general
    expect(hosting.headers.findIndex((h: any) => h.source === '/assets/**')).toBeGreaterThan(hosting.headers.findIndex((h: any) => h.source === '**'));
  });

  it('el SPA sigue reescribiendo todo a /index.html', () => {
    expect(hosting.rewrites).toEqual([{ source: '**', destination: '/index.html' }]);
  });
});

import { estadoCarga, mostrarCargaYa, ocultarCargaYa, __resetCarga, iniciarOperacion } from '@/services/carga';
import { CLAVE_RECARGANDO, marcarRecargando, vienesDeRecarga } from '@/utils/actualizacion';
import VersionApp from '@/components/VersionApp.vue';

describe('carga al deslizar para actualizar', () => {
  beforeEach(() => { __resetCarga(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); __resetCarga(); });

  it('mostrarCargaYa muestra el indicador de inmediato (sin esperar a que algo tarde)', () => {
    expect(estadoCarga.visible.value).toBe(false);
    mostrarCargaYa();
    expect(estadoCarga.visible.value).toBe(true);
  });

  it('se esconde sola si la recarga no llega a ocurrir (p. ej. sin internet)', () => {
    mostrarCargaYa(5000);
    vi.advanceTimersByTime(4900);
    expect(estadoCarga.visible.value).toBe(true);
    vi.advanceTimersByTime(200);
    expect(estadoCarga.visible.value).toBe(false);
  });

  it('ocultarCargaYa lo esconde, salvo que haya algo pendiente de verdad', () => {
    mostrarCargaYa();
    ocultarCargaYa();
    expect(estadoCarga.visible.value).toBe(false);
    const terminar = iniciarOperacion();
    mostrarCargaYa();
    ocultarCargaYa();
    expect(estadoCarga.visible.value).toBe(true);
    terminar();
  });

  it('recargar deja la marca; al arrancar se consume una sola vez y solo vale 30 segundos', async () => {
    const memoria: Record<string, string> = {};
    const almacen = { getItem: (k: string) => memoria[k] ?? null, setItem: (k: string, v: string) => { memoria[k] = v; }, removeItem: (k: string) => { delete memoria[k]; } };
    expect(vienesDeRecarga(1000, almacen)).toBe(false);
    marcarRecargando(almacen);
    expect(Object.keys(memoria)).toEqual([CLAVE_RECARGANDO]);
    expect(vienesDeRecarga(Date.now() + 2000, almacen)).toBe(true);
    expect(vienesDeRecarga(Date.now() + 2000, almacen)).toBe(false); // ya se consumió
    marcarRecargando(almacen);
    expect(vienesDeRecarga(Date.now() + 60_000, almacen)).toBe(false); // muy vieja
  });

  it('recargarConLoNuevo deja la marca antes de recargar', async () => {
    sessionStorage.clear();
    let marcaAlRecargar: string | null = null;
    await recargarConLoNuevo({ consultar: (async () => respuesta({})) as any, recargar: () => { marcaAlRecargar = sessionStorage.getItem(CLAVE_RECARGANDO); } });
    expect(marcaAlRecargar).not.toBeNull();
  });
});

describe('pantalla de arranque y versión visible', () => {
  it('index.html trae una pantalla de carga dentro de #app, para que nunca se vea vacío antes de que cargue el JavaScript', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<div id="app">[\s\S]*class="arranque"[\s\S]*<\/div>\s*<script type="module"/);
    expect(html).toContain('role="status"');
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('la etiqueta de versión muestra la versión que corre', () => {
    const w = mount(VersionApp);
    expect(w.text()).toMatch(/^Versión \S+/);
    expect(w.find('[data-testid="version-app"]').exists()).toBe(true);
  });
});
