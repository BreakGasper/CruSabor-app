import { db } from '@/firebase';
import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { ref as dbRef, runTransaction, onValue, update, type Unsubscribe } from '@/services/baseDatos';
import type { ClienteServicio } from './tipos';

/**
 * Resumen de cada cliente para la tienda (`clientesServicio/{tiendaId}/{clienteId}`): cuántas citas y cotizaciones
 * ha pedido y cuándo fue lo último. Se actualiza solo al reservar o cotizar. Si falla, la cita o cotización ya quedó
 * guardada: el resumen es un apoyo, no un requisito.
 */
export async function registrarActividadCliente(
  tiendaId: string,
  c: { id: string; nombre?: string; telefono?: string },
  tipo: 'cita' | 'cotizacion',
  ahora: Date = new Date(),
): Promise<void> {
  try {
    await runTransaction(dbRef(db, `clientesServicio/${tiendaId}/${c.id}`), (actual: any) => ({
      ...(actual ?? {}),
      clienteId: c.id,
      nombre: c.nombre || actual?.nombre || 'Cliente',
      telefono: c.telefono || actual?.telefono || '',
      citas: (Number(actual?.citas) || 0) + (tipo === 'cita' ? 1 : 0),
      cotizaciones: (Number(actual?.cotizaciones) || 0) + (tipo === 'cotizacion' ? 1 : 0),
      ultimaActividad: ahora.toISOString(),
    }));
  } catch (e) {
    console.warn('No se pudo actualizar el resumen del cliente:', e);
  }
}

/* ------------------------------ Lectura y notas (pantalla «Clientes») ------------------------------ */

/** Clientes de la tienda en vivo (el más reciente primero) */
export function useClientesServicio(tiendaId: () => string | undefined): { clientes: Ref<ClienteServicio[]>; cargando: Ref<boolean> } {
  const clientes = ref<ClienteServicio[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(() => {
    const id = tiendaId();
    if (!id) {
      cargando.value = false;
      return;
    }
    off = onValue(dbRef(db, `clientesServicio/${id}`), (snap) => {
      clientes.value = Object.entries(snap.val() || {})
        .map(([cid, v]: [string, any]) => ({
          clienteId: cid,
          nombre: String(v?.nombre ?? ''),
          telefono: String(v?.telefono ?? ''),
          citas: Number(v?.citas) || 0,
          cotizaciones: Number(v?.cotizaciones) || 0,
          ultimaActividad: String(v?.ultimaActividad ?? ''),
          notas: v?.notas || '',
        }))
        .sort((a, b) => b.ultimaActividad.localeCompare(a.ultimaActividad));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { clientes, cargando };
}

/** Nota privada de la tienda sobre un cliente (vacía = se borra) */
export async function guardarNotaCliente(tiendaId: string, clienteId: string, nota: string): Promise<void> {
  const limpia = nota.trim().slice(0, 500);
  await update(dbRef(db, `clientesServicio/${tiendaId}/${clienteId}`), { notas: limpia || null });
}
