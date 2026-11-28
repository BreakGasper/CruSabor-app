import { describe, it, expect, vi } from 'vitest';
import { ErrorServicio, mensajeError } from '@/modules/servicios/catalogo';

describe('mensajeError', () => {
  it('respeta el mensaje de los errores propios', () => {
    expect(mensajeError(new ErrorServicio('Ese horario acaba de ocuparse.'))).toBe('Ese horario acaba de ocuparse.');
  });
  it('explica la falta de permisos y la falta de conexión', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(mensajeError({ code: 'PERMISSION_DENIED', message: 'Permission denied' })).toMatch(/no permite guardar/);
    expect(mensajeError(new Error('Failed to fetch'))).toMatch(/No hay conexión/);
  });
  it('en cualquier otro caso muestra la causa para poder reportarla', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(mensajeError(new Error('x is not a function'))).toBe('Algo salió mal: x is not a function');
    expect(mensajeError(null)).toBe('Intenta de nuevo en unos minutos.');
  });
});
