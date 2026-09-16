/**
 * Cliente mínimo de la API de Mercado Pago (Checkout Pro) con fetch nativo de Node.
 * Docs: https://www.mercadopago.com.mx/developers/es/reference
 */
const API = 'https://api.mercadopago.com';

async function llamar(token: string, ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const texto = await r.text();
  let data: any;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = { raw: texto };
  }
  if (!r.ok) {
    const msg = data?.message || data?.error || `HTTP ${r.status}`;
    throw new ErrorMercadoPago(`Mercado Pago ${ruta}: ${msg}`, r.status);
  }
  return data;
}

/** Error de la API de Mercado Pago con el código HTTP (404 = el recurso no existe) */
export class ErrorMercadoPago extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.name = 'ErrorMercadoPago';
    this.status = status;
  }
}

export interface DatosPreferencia {
  titulo: string;
  descripcion: string;
  monto: number;
  externalReference: string;
  notificationUrl: string;
  backUrls: { success: string; pending: string; failure: string };
  payerEmail?: string;
  idempotencyKey?: string;
}

/** Crea una preferencia de Checkout Pro y devuelve la URL de pago */
export async function crearPreferencia(token: string, d: DatosPreferencia) {
  const body: any = {
    items: [
      {
        id: d.externalReference,
        title: d.titulo,
        description: d.descripcion,
        quantity: 1,
        currency_id: 'MXN',
        unit_price: Number(d.monto),
      },
    ],
    external_reference: d.externalReference,
    notification_url: d.notificationUrl,
    back_urls: d.backUrls,
    statement_descriptor: 'MAVI',
    metadata: { external_reference: d.externalReference },
  };
  // auto_return regresa solo a la app al aprobarse, pero Mercado Pago EXIGE que
  // back_urls.success sea una URL pública https; con localhost la rechaza
  // ("auto_return invalid. back_url.success must be defined"). En local se omite:
  // la preferencia se crea igual y el pago funciona, solo que sin redirección sola.
  if (/^https:\/\//i.test(d.backUrls.success)) body.auto_return = 'approved';
  if (d.payerEmail) body.payer = { email: d.payerEmail };

  const pref = await llamar(token, '/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: d.idempotencyKey ? { 'X-Idempotency-Key': d.idempotencyKey } : {},
  });
  return { id: pref.id as string, url: pref.init_point as string, sandboxUrl: pref.sandbox_init_point as string | undefined };
}

/** Consulta un pago por id (lo que llega en el webhook) */
export function obtenerPago(token: string, pagoId: string | number) {
  return llamar(token, `/v1/payments/${encodeURIComponent(String(pagoId))}`);
}
