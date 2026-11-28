import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const real = await vi.importActual<typeof import('@/utils/recortarFoto')>('@/utils/recortarFoto');
const foto = (n = 'a.jpg') => new File(['x'], n, { type: 'image/jpeg' });

describe('recortarFoto (utilidad)', () => {
  it('abre el editor con la foto y la proporción, y devuelve lo que entregue', async () => {
    const f = foto();
    const p = real.recortarFoto(f, '3:1');
    expect(real.peticionRecorte.value).toEqual({ archivo: f, aspecto: '3:1' });
    const recortada = foto('recortada.jpg');
    real.resolverRecorte(recortada);
    expect(await p).toBe(recortada);
    expect(real.peticionRecorte.value).toBeNull(); // el editor se cierra
  });

  it('cancelar devuelve null', async () => {
    const p = real.recortarFoto(foto());
    real.resolverRecorte(null);
    expect(await p).toBeNull();
  });

  it('lo que no es imagen pasa tal cual, sin abrir el editor', async () => {
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    expect(await real.recortarFoto(pdf)).toBe(pdf);
    expect(real.peticionRecorte.value).toBeNull();
  });

  it('una petición nueva cancela la anterior que seguía abierta', async () => {
    const primera = real.recortarFoto(foto('1.jpg'));
    const segunda = real.recortarFoto(foto('2.jpg'));
    expect(await primera).toBeNull();
    real.resolverRecorte(foto('2r.jpg'));
    expect((await segunda)?.name).toBe('2r.jpg');
  });

  it('recortarFotos las atiende una por una y omite las canceladas', async () => {
    const lote = real.recortarFotos([foto('1.jpg'), foto('2.jpg'), foto('3.jpg')], '4:3');
    await nextTick();
    expect(real.peticionRecorte.value?.archivo.name).toBe('1.jpg');
    real.resolverRecorte(foto('1r.jpg'));
    await new Promise((r) => setTimeout(r, 0));
    expect(real.peticionRecorte.value?.archivo.name).toBe('2.jpg');
    real.resolverRecorte(null); // cancela la 2
    await new Promise((r) => setTimeout(r, 0));
    expect(real.peticionRecorte.value?.archivo.name).toBe('3.jpg');
    real.resolverRecorte(foto('3r.jpg'));
    expect((await lote).map((f) => f.name)).toEqual(['1r.jpg', '3r.jpg']);
  });
});

describe('RecortadorGlobal', () => {
  it('muestra el editor con la foto pedida y contesta lo que la persona decide', async () => {
    const { default: RecortadorGlobal } = await import('@/components/RecortadorGlobal.vue');
    const editor = { props: ['archivo', 'aspectoInicial'], emits: ['listo', 'sinCambios', 'cancelar'], template: '<div class="editor" :data-archivo="archivo?.name" :data-aspecto="aspectoInicial"></div>' };
    const w = mount(RecortadorGlobal, { global: { stubs: { RecortadorImagen: editor } } });
    expect(w.find('.editor').attributes('data-archivo')).toBeUndefined();

    const original = foto('original.jpg');
    const p = real.recortarFoto(original, '1:1');
    await nextTick();
    expect(w.find('.editor').attributes('data-archivo')).toBe('original.jpg');
    expect(w.find('.editor').attributes('data-aspecto')).toBe('1:1');
    await w.findComponent(editor).vm.$emit('sinCambios'); // «Usar sin recortar» devuelve la original
    expect(await p).toBe(original);

    const q = real.recortarFoto(foto('b.jpg'));
    await nextTick();
    await w.findComponent(editor).vm.$emit('cancelar');
    expect(await q).toBeNull();
    w.unmount();
  });
});
