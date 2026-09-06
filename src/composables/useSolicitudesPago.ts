import { ref, onUnmounted } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue, push, update } from 'firebase/database';
import { sessionAdmin } from '@/utils/sessionAdmin';
import type { PlanMembresia } from '@/composables/useAdminTiendas';

/**
 * Pago semiautomático de membresía (sin servidor ni Blaze):
 *  1. El administrador crea links de pago en su panel de Mercado Pago y los guarda en
 *     `configuracion/pagos` (uno por plan).
 *  2. La tienda abre el link desde su perfil, paga, y pulsa "Ya pagué": se crea una
 *     solicitud en `solicitudesPago/{id}` con el plan y la referencia que indique.
 *  3. El administrador ve las solicitudes en el tablero, confirma el pago en su cuenta de
 *     Mercado Pago y lo registra con el modal de pago; la solicitud queda atendida.
 */

export type EstadoSolicitud = 'reportado' | 'atendido' | 'descartado';

export interface SolicitudPago {
  id?: string;
  tiendaId: string;
  nombreTienda: string;
  plan: PlanMembresia;
  referencia?: string;
  fecha: string; // ISO
  estado: EstadoSolicitud;
  atendidoEn?: string;
  atendidoPor?: string;
  nota?: string;
}

/** La tienda avisa que ya pagó. Devuelve el id de la solicitud. */
export async function reportarPago(datos: {
  tiendaId: string;
  nombreTienda: string;
  plan: PlanMembresia;
  referencia?: string;
}): Promise<string> {
  if (!datos.tiendaId) throw new Error('Tienda sin id');
  const id = push(dbRef(db, 'solicitudesPago')).key!;
  const solicitud: SolicitudPago = {
    tiendaId: datos.tiendaId,
    nombreTienda: datos.nombreTienda || '',
    plan: datos.plan,
    fecha: new Date().toISOString(),
    estado: 'reportado',
  };
  const referencia = (datos.referencia || '').trim();
  if (referencia) solicitud.referencia = referencia.slice(0, 80);
  await update(dbRef(db), { [`solicitudesPago/${id}`]: solicitud });
  return id;
}

/** El administrador cierra una solicitud (pago registrado o descartada). */
export async function atenderSolicitud(id: string, estado: 'atendido' | 'descartado', nota?: string): Promise<void> {
  const cambios: Record<string, any> = {
    [`solicitudesPago/${id}/estado`]: estado,
    [`solicitudesPago/${id}/atendidoEn`]: new Date().toISOString(),
    [`solicitudesPago/${id}/atendidoPor`]: sessionAdmin.value?.nombre || 'admin',
  };
  if (nota?.trim()) cambios[`solicitudesPago/${id}/nota`] = nota.trim();
  await update(dbRef(db), cambios);
}

const porFechaDesc = (a: SolicitudPago, b: SolicitudPago) => (a.fecha < b.fecha ? 1 : -1);

/** Solicitudes en vivo. Con `soloPendientes` solo las reportadas (las que debe atender el admin). */
export function useSolicitudesPago(opciones: { soloPendientes?: boolean; tiendaId?: () => string | undefined } = {}) {
  const solicitudes = ref<SolicitudPago[]>([]);
  const cargando = ref(true);
  const off = onValue(
    dbRef(db, 'solicitudesPago'),
    (snap) => {
      const data = (snap.val() || {}) as Record<string, any>;
      const tid = opciones.tiendaId?.();
      solicitudes.value = Object.entries(data)
        .map(([id, s]) => ({ ...(s as SolicitudPago), id }))
        .filter((s) => !opciones.soloPendientes || s.estado === 'reportado')
        .filter((s) => !opciones.tiendaId || s.tiendaId === tid)
        .sort(porFechaDesc);
      cargando.value = false;
    },
    (e) => {
      console.error('❌ Error leyendo solicitudesPago:', e);
      cargando.value = false;
    },
  );
  onUnmounted(off);
  return { solicitudes, cargando };
}
