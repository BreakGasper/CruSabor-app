import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, push, set, update, remove, onValue, type Unsubscribe } from 'firebase/database';
import { sessionUser } from '@/utils/sessionUser';

/**
 * Libreta de direcciones del cliente.
 *
 * Se guarda en Firebase en `usuarios/{id}/direcciones/{dirId}`.
 * La dirección del registro (calleNumero, lugar, municipio, estado, codigoPostal)
 * se expone como una entrada virtual "principal": no se puede borrar y no se
 * sobreescribe cuando el cliente agrega otras.
 */
export interface Direccion {
  id: string;
  alias: string; // "Casa", "Oficina", ...
  calle: string;
  numero: string;
  colonia: string;
  municipio: string;
  estado: string;
  cp: string;
  predeterminada?: boolean;
  /** true para la dirección del registro (virtual, no borrable) */
  principal?: boolean;
  fecha?: string;
}

export type DireccionInput = Omit<Direccion, 'id' | 'principal' | 'fecha'>;

export const PRINCIPAL_ID = 'principal';

/** Máximo de ubicaciones por cliente (incluye la del registro). */
export const MAX_DIRECCIONES = 3;

/** Texto de una dirección en una línea */
export function direccionTexto(d: Partial<Direccion> | null | undefined): string {
  if (!d) return '';
  const calle = [d.calle, d.numero ? `#${d.numero}` : ''].filter(Boolean).join(' ');
  return [calle, d.colonia, d.municipio, d.estado, d.cp ? `CP ${d.cp}` : '']
    .filter(Boolean)
    .join(', ');
}

/** Dirección del registro a partir de la sesión (formato viejo: "Calle #123") */
export function direccionPrincipalDeSesion(u: any): Direccion | null {
  if (!u) return null;
  const calleNumero: string = u.domicilio || u.calleNumero || '';
  const [calle, numero] = calleNumero.split('#').map((s: string) => s.trim());
  const dir: Direccion = {
    id: PRINCIPAL_ID,
    alias: 'Principal',
    calle: calle || '',
    numero: numero || '',
    colonia: u.colonia || u.lugar || '',
    municipio: u.municipio || '',
    estado: u.estado || '',
    cp: u.codigpostal || u.codigoPostal || '',
    principal: true,
  };
  return direccionTexto(dir) ? dir : null;
}

export function direccionCompleta(d: Partial<DireccionInput>): boolean {
  return !!(d.calle && d.numero && d.colonia && d.municipio && d.estado && d.cp);
}

export function useDirecciones() {
  const guardadas = ref<Direccion[]>([]);
  const cargando = ref(true);
  let detener: Unsubscribe | null = null;

  const uid = () => sessionUser.value?.id as string | undefined;
  const coleccion = (id: string) => dbRef(db, `usuarios/${id}/direcciones`);

  function suscribir() {
    detener?.();
    detener = null;
    const id = uid();
    if (!id) {
      guardadas.value = [];
      cargando.value = false;
      return;
    }
    cargando.value = true;
    detener = onValue(coleccion(id), (snap) => {
      const data = snap.val() || {};
      guardadas.value = Object.keys(data)
        .map((k) => ({ ...data[k], id: k }) as Direccion)
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      cargando.value = false;
    });
  }

  onMounted(suscribir);
  watch(() => sessionUser.value?.id, suscribir);
  onUnmounted(() => detener?.());

  /** Principal (del registro) + guardadas */
  const direcciones = computed<Direccion[]>(() => {
    const principal = direccionPrincipalDeSesion(sessionUser.value);
    return principal ? [principal, ...guardadas.value] : [...guardadas.value];
  });

  /** Cuántas se pueden agregar todavía */
  const disponibles = computed(() => Math.max(0, MAX_DIRECCIONES - direcciones.value.length));
  const puedeAgregar = computed(() => disponibles.value > 0);

  /** La marcada como predeterminada, si no la principal, si no la primera */
  const predeterminada = computed<Direccion | null>(
    () =>
      direcciones.value.find((d) => d.predeterminada) ??
      direcciones.value.find((d) => d.principal) ??
      direcciones.value[0] ??
      null,
  );

  async function agregar(input: DireccionInput): Promise<string> {
    const id = uid();
    if (!id) throw new Error('Usuario no autenticado');
    if (!direccionCompleta(input)) throw new Error('Completa todos los campos de la dirección');
    if (!puedeAgregar.value) {
      throw new Error(
        `Solo puedes tener ${MAX_DIRECCIONES} ubicaciones. Elimina una para agregar otra.`,
      );
    }
    const nueva = push(coleccion(id));
    await set(nueva, {
      alias: input.alias?.trim() || 'Otra dirección',
      calle: input.calle.trim(),
      numero: String(input.numero).trim(),
      colonia: input.colonia.trim(),
      municipio: input.municipio.trim(),
      estado: input.estado.trim(),
      cp: String(input.cp).trim(),
      predeterminada: !!input.predeterminada,
      fecha: new Date().toISOString(),
    });
    if (input.predeterminada) await marcarPredeterminada(nueva.key!);
    return nueva.key!;
  }

  async function eliminar(dirId: string) {
    const id = uid();
    if (!id || dirId === PRINCIPAL_ID) return;
    await remove(dbRef(db, `usuarios/${id}/direcciones/${dirId}`));
  }

  /** Solo una puede ser predeterminada. Marcar la principal desmarca las demás. */
  async function marcarPredeterminada(dirId: string) {
    const id = uid();
    if (!id) return;
    const cambios: Record<string, any> = {};
    for (const d of guardadas.value) cambios[`${d.id}/predeterminada`] = d.id === dirId;
    if (Object.keys(cambios).length) await update(coleccion(id), cambios);
  }

  return {
    direcciones,
    guardadas,
    predeterminada,
    cargando,
    disponibles,
    puedeAgregar,
    agregar,
    eliminar,
    marcarPredeterminada,
  };
}
