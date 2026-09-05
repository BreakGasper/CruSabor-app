// Entorno común para las pruebas: IndexedDB en memoria para Dexie
// y variables de entorno vacías para que firebase.ts no falle al importarse.
import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import '@/plugins/fontawesome'; // registra los iconos usados por los componentes

// Nunca hablamos con Firebase real en pruebas: el módulo se sustituye por el mock en memoria.
vi.mock('firebase/database', async () => await import('./mocks/firebaseDb'));
vi.mock('@/firebase', () => ({ db: { __mock: true }, auth: {} }));

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
