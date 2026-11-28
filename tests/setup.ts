// Entorno común para las pruebas: IndexedDB en memoria para Dexie
// y variables de entorno vacías para que firebase.ts no falle al importarse.
import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import '@/plugins/fontawesome'; // registra los iconos usados por los componentes

// Nunca hablamos con Firebase real en pruebas: el módulo se sustituye por el mock en memoria.
vi.mock('firebase/database', async () => await import('./mocks/firebaseDb'));
vi.mock('@/firebase', () => ({ db: { __mock: true }, auth: {} }));

// Recorte de fotos al elegirlas: en las pruebas no hay editor, así que por defecto la foto pasa tal cual.
// Cada prueba puede cambiar el comportamiento (por ejemplo, devolver null para simular «Cancelar»).
export const recorteMock = {
  recortarFoto: vi.fn(async (f: File, _aspecto?: string) => f as File | null),
  recortarFotos: vi.fn(async (fs: File[], _aspecto?: string) => fs),
};
vi.mock('@/utils/recortarFoto', async () => {
  const real = await vi.importActual<typeof import('@/utils/recortarFoto')>('@/utils/recortarFoto');
  return { ...real, recortarFoto: (f: File, a?: string) => recorteMock.recortarFoto(f, a), recortarFotos: (fs: File[], a?: string) => recorteMock.recortarFotos(fs, a) };
});

// vue-router: las composables solo usan push/replace
export const routerMock = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
export const routeMock: { params: Record<string, any>; query: Record<string, any> } = { params: {}, query: {} };
vi.mock('vue-router', () => ({
  useRouter: () => routerMock,
  useRoute: () => routeMock,
}));

// SweetAlert2: sin DOM real; cada prueba decide la respuesta con swalMock.fire.mockResolvedValue(...)
export const swalMock = { fire: vi.fn(async () => ({ isConfirmed: true, value: '' })) };
vi.mock('sweetalert2', () => ({ default: swalMock }));
