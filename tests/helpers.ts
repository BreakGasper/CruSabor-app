import { createApp, type App } from 'vue';

/**
 * Ejecuta una composable dentro de un componente real para que
 * onMounted / onUnmounted / watch funcionen igual que en la app.
 */
export function withSetup<T>(composable: () => T): { result: T; app: App; unmount: () => void } {
  let result!: T;
  const app = createApp({
    setup() {
      result = composable();
      return () => null;
    },
  });
  const el = document.createElement('div');
  document.body.appendChild(el);
  app.mount(el);
  return { result, app, unmount: () => { app.unmount(); el.remove(); } };
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
