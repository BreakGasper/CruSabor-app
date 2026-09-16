/**
 * Envío de correo: en producción usa la API HTTP de Brevo (Render bloquea el SMTP
 * directo a Gmail). Se prueba que, con BREVO_API_KEY, se llama a Brevo con el cuerpo
 * correcto y que un fallo se reporta en vez de colgarse.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { enviarCorreo } from '@/services/mailService';

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
  delete process.env.BREVO_API_KEY;
  delete process.env.SMTP_USER;
});

describe('enviarCorreo con Brevo', () => {
  it('llama a la API de Brevo con remitente, destinatario y contenido', async () => {
    process.env.BREVO_API_KEY = 'clave-brevo';
    process.env.SMTP_USER = 'remitente@mavi.mx';
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, text: async () => '' }));
    global.fetch = fetchMock as any;

    const r = await enviarCorreo({ to: 'cliente@correo.mx', subject: 'Código', html: '<b>1234</b>' });
    expect(r.success).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init as any).headers['api-key']).toBe('clave-brevo');
    const body = JSON.parse((init as any).body);
    expect(body.sender.email).toBe('remitente@mavi.mx');
    expect(body.to).toEqual([{ email: 'cliente@correo.mx' }]);
    expect(body.subject).toBe('Código');
    expect(body.htmlContent).toContain('1234');
  });

  it('si Brevo responde error, lo reporta (no se cuelga)', async () => {
    process.env.BREVO_API_KEY = 'clave-brevo';
    process.env.SMTP_USER = 'remitente@mavi.mx';
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Key not found' })) as any;

    const r = await enviarCorreo({ to: 'x@y.mx', subject: 's', html: 'h' });
    expect(r.success).toBe(false);
    expect(String(r.error?.message)).toContain('401');
  });

  it('sin BREVO_API_KEY ni SMTP falla de inmediato con un motivo claro', async () => {
    const r = await enviarCorreo({ to: 'x@y.mx', subject: 's', html: 'h' });
    expect(r.success).toBe(false);
    expect(String(r.error?.message)).toMatch(/no configurado/i);
  });
});
