/**
 * La app se ve fija, a las dimensiones del teléfono: sin pellizcar para acercar o alejar.
 *
 * Capas, porque cada navegador respeta una distinta:
 *  - `index.html`: <meta viewport> con maximum-scale=1, minimum-scale=1 y user-scalable=no (Android/Chrome);
 *  - CSS: `touch-action: pan-x pan-y` en html (sin pinch ni doble toque para ampliar);
 *  - aquí: Safari de iPhone ignora el meta y el CSS para el pellizco, pero avisa con `gesturestart`/`gesturechange`;
 *    y los iOS más viejos mandan `touchmove` con `scale` distinto de 1. Se cancelan los dos.
 *
 * Aviso de accesibilidad: quien necesita letra más grande ya no puede ampliar con el pellizco; la app usa tamaños
 * de texto cómodos y respeta el tamaño de letra del sistema (rem/em).
 */
export function instalarSinZoom(doc: Document = document): () => void {
  const cancelar = (e: Event) => e.preventDefault();
  const alMover = (e: Event) => {
    const t = e as TouchEvent & { scale?: number };
    if (typeof t.scale === 'number' && t.scale !== 1) e.preventDefault();
    // Dos dedos en la pantalla = pellizco
    else if (t.touches && t.touches.length > 1) e.preventDefault();
  };
  doc.addEventListener('gesturestart', cancelar, { passive: false });
  doc.addEventListener('gesturechange', cancelar, { passive: false });
  doc.addEventListener('gestureend', cancelar, { passive: false });
  doc.addEventListener('touchmove', alMover, { passive: false });
  return () => {
    doc.removeEventListener('gesturestart', cancelar);
    doc.removeEventListener('gesturechange', cancelar);
    doc.removeEventListener('gestureend', cancelar);
    doc.removeEventListener('touchmove', alMover);
  };
}
