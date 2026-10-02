/**
 * Festividad que se ve ahora (ver festividades.ts). Una temática creada a mano y
 * vigente tiene prioridad: mientras esté en curso no se muestra la festividad.
 */
import { computed } from 'vue';
import { useConfiguracion } from '@/composables/useConfiguracion';
import { hoyISO, tematicaVigente } from '@/composables/useTematicas';
import { festividadEnCurso, iconoFestividad } from '@/composables/festividades';

export function useFestividad() {
  const { configuracion, cargada } = useConfiguracion();
  const festividad = computed(() => {
    if (!cargada.value) return null;
    const a = configuracion.value.apariencia;
    const hoy = hoyISO();
    if (Object.values(a.tematicas).some((t) => tematicaVigente(t, hoy))) return null;
    const en = festividadEnCurso(a.festivas, hoy);
    if (!en) return null;
    const [id, f] = en;
    return { id, ...f, url: iconoFestividad(f) };
  });
  return { festividad };
}
