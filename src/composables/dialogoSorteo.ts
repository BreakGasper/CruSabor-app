import Swal from 'sweetalert2';
import { sessionUser } from '@/utils/sessionUser';
import {
  estadoSorteo,
  participarEnSorteo,
  yaParticipa,
  patrocinadores,
  nombrePublico,
  ErrorSorteo,
  type Sorteo,
} from '@/composables/useSorteos';

/**
 * Diálogo para participar en un sorteo: se abre al tocar el banner del carrusel o el botón flotante de una tienda.
 * Pide el código que dio la tienda; si el código no sirve, avisa dentro del mismo diálogo y deja corregirlo.
 */

const esc = (t: unknown) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const COLOR = 'var(--color-bg-blue-ligth)';

export interface OpcionesDialogo {
  /** Lleva a la pantalla de inicio de sesión */
  irALogin: () => void;
  usuario?: { id?: string; nombre?: string; telefono?: string } | null;
}

function resumen(s: Sorteo): string {
  const tiendas = patrocinadores(s).map((t) => t.nombreTienda).filter(Boolean);
  return [
    s.premio ? `<p style="margin:0 0 6px"><b>🏆 ${esc(s.premio)}</b></p>` : '',
    s.descripcion ? `<p style="margin:0 0 6px;font-size:.9rem">${esc(s.descripcion)}</p>` : '',
    tiendas.length ? `<p style="margin:0;font-size:.82rem;opacity:.8">Patrocinan: ${esc(tiendas.join(', '))}</p>` : '',
  ].join('');
}

/** Abre el diálogo que corresponde según el estado del sorteo y de la persona. Devuelve true si quedó participando. */
export async function abrirDialogoSorteo(s: Sorteo, opciones: OpcionesDialogo): Promise<boolean> {
  const estado = estadoSorteo(s);

  if (estado === 'proximo') {
    await Swal.fire({ icon: 'info', title: s.titulo, html: `${resumen(s)}<p style="margin-top:10px">Podrás participar a partir del <b>${esc(s.fechaInicio)}</b>.</p>`, confirmButtonColor: COLOR });
    return false;
  }
  if (estado !== 'abierto') {
    const ganadores = s.ganadores.map((g) => nombrePublico(g.nombre)).join(', ');
    await Swal.fire({
      icon: 'info',
      title: s.titulo,
      html: `${resumen(s)}<p style="margin-top:10px">${ganadores ? `🎉 Ganó: <b>${esc(ganadores)}</b>` : 'Este sorteo ya no está recibiendo participantes.'}</p>`,
      confirmButtonColor: COLOR,
    });
    return false;
  }

  const u = opciones.usuario ?? sessionUser.value;
  if (!u?.id) {
    const r = await Swal.fire({
      icon: 'info',
      title: 'Inicia sesión para participar',
      html: resumen(s),
      showCancelButton: true,
      confirmButtonText: 'Iniciar sesión',
      cancelButtonText: 'Ahora no',
      confirmButtonColor: COLOR,
    });
    if (r.isConfirmed) opciones.irALogin();
    return false;
  }

  if (await yaParticipa(s.id, u.id).catch(() => false)) {
    await Swal.fire({ icon: 'success', title: 'Ya estás participando', html: `${resumen(s)}<p style="margin-top:10px">¡Mucha suerte! 🍀</p>`, confirmButtonColor: COLOR });
    return true;
  }

  const r = await Swal.fire({
    title: s.titulo,
    html: `${resumen(s)}<p style="margin:12px 0 0;font-weight:600">Escribe el código que te dio la tienda</p>`,
    input: 'text',
    inputPlaceholder: 'Ej. LOLA-7K3Q',
    inputAttributes: { autocapitalize: 'characters', autocomplete: 'off', maxlength: '24', 'data-testid': 'codigo-dialogo' },
    showCancelButton: true,
    confirmButtonText: 'Participar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: COLOR,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    // Si algo falla, el mensaje sale dentro del mismo diálogo y se puede corregir el código sin volver a abrirlo
    preConfirm: async (codigo: string) => {
      try {
        return await participarEnSorteo(s.id, { id: u.id!, nombre: u.nombre, telefono: u.telefono }, codigo);
      } catch (e: any) {
        Swal.showValidationMessage(e instanceof ErrorSorteo ? e.message : 'No se pudo participar. Intenta de nuevo en unos minutos.');
        return false;
      }
    },
  });

  if (!r.isConfirmed || !r.value) return false;
  await Swal.fire({
    icon: 'success',
    title: '¡Ya estás participando!',
    text: `Tu código de ${(r.value as { nombreTienda: string }).nombreTienda} quedó registrado. Mucha suerte.`,
    confirmButtonColor: COLOR,
  });
  return true;
}
