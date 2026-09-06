import type { PlanMembresia } from '@/composables/useAdminTiendas';

/**
 * Pago automático de membresía con Mercado Pago (Checkout Pro) a través del servidor
 * Express del proyecto (src/services/pagos/router.ts). La app solo pide la URL de pago;
 * el cobro y la activación de la membresía ocurren en el servidor vía webhook.
 */

export type ResultadoPago = 'exito' | 'pendiente' | 'error';

/** Base del servidor Express: VITE_API_URL o el puerto 3000 local */
export function urlApi(env: Record<string, any> = (import.meta as any).env || {}): string {
  return String(env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export interface InicioPago {
  intentoId: string;
  url: string;
  monto: number;
  plan: PlanMembresia;
}

/** Crea el pago y devuelve la URL a la que hay que mandar a la tienda */
export async function iniciarPagoMembresia(
  datos: { tiendaId: string; plan: PlanMembresia; origen?: string },
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = urlApi(),
): Promise<InicioPago> {
  let r: Response;
  try {
    r = await fetchImpl(`${baseUrl}/pagos/membresia/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tiendaId: datos.tiendaId,
        plan: datos.plan,
        origen: datos.origen ?? (typeof window !== 'undefined' ? window.location.origin : undefined),
      }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor de pagos. Intenta más tarde.');
  }
  let data: any = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  if (!r.ok) throw new Error(data?.error || `No se pudo iniciar el pago (HTTP ${r.status})`);
  if (!data?.url) throw new Error('Mercado Pago no devolvió la URL de pago');
  return { intentoId: data.intentoId, url: data.url, monto: Number(data.monto), plan: data.plan };
}

/** Lee el resultado con el que Mercado Pago regresa a la app (?pago=exito|pendiente|error) */
export function resultadoPagoDesdeQuery(query: Record<string, unknown>): ResultadoPago | null {
  const v = String(query?.pago ?? '');
  return v === 'exito' || v === 'pendiente' || v === 'error' ? v : null;
}

export const MENSAJE_RESULTADO_PAGO: Record<ResultadoPago, { titulo: string; texto: string; icon: 'success' | 'info' | 'error' }> = {
  exito: {
    icon: 'success',
    titulo: '¡Pago recibido!',
    texto: 'Tu membresía se activará en unos segundos. Si no ves el cambio, actualiza la página.',
  },
  pendiente: {
    icon: 'info',
    titulo: 'Pago en proceso',
    texto: 'Mercado Pago aún está confirmando tu pago. En cuanto se apruebe, tu membresía se activará sola.',
  },
  error: {
    icon: 'error',
    titulo: 'El pago no se completó',
    texto: 'No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.',
  },
};
