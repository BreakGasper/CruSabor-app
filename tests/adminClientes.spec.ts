/**
 * Soporte a clientes desde el admin: búsqueda, restablecer contraseña y editar datos.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';
import { validatePasswordHash } from '@/composables/usePassword';
import {
  filtrarClientes,
  buscarClientes,
  restablecerPasswordCliente,
  actualizarClienteAdmin,
  type ClienteAdmin,
} from '@/composables/useAdminClientes';

const CLIENTES = [
  { id: 'u1', nombre: 'Carlos Gaspar', celular: '3751241114', email: 'carlos@correo.mx' },
  { id: 'u2', nombre: 'Ana López', celular: '3339990000', email: 'ana@correo.mx' },
] as ClienteAdmin[];

describe('filtrarClientes (regla pura)', () => {
  it('busca por nombre, celular o correo; vacío = todos', () => {
    expect(filtrarClientes(CLIENTES, '')).toHaveLength(2);
    expect(filtrarClientes(CLIENTES, 'ana').map((c) => c.id)).toEqual(['u2']);
    expect(filtrarClientes(CLIENTES, '375-124').map((c) => c.id)).toEqual(['u1']);
    expect(filtrarClientes(CLIENTES, 'carlos@').map((c) => c.id)).toEqual(['u1']);
    expect(filtrarClientes(CLIENTES, 'zzz')).toHaveLength(0);
  });
});

describe('operaciones de soporte', () => {
  beforeEach(() =>
    __reset({
      usuarios: {
        u1: { celular: '3751241114', nombre: 'Carlos Gaspar', email: 'carlos@correo.mx', pass: 'hash-viejo' },
        u2: { celular: '3339990000', nombre: 'Ana López', email: 'ana@correo.mx', pass: 'x' },
      },
    }),
  );

  it('buscarClientes encuentra por celular', async () => {
    const r = await buscarClientes('3339990000');
    expect(r.map((c) => c.id)).toEqual(['u2']);
  });

  it('restablecerPasswordCliente guarda el hash (no el texto) y valida largo', async () => {
    await restablecerPasswordCliente('u1', 'nueva123');
    const hash = __getAt('usuarios/u1/pass');
    expect(hash).not.toBe('nueva123');
    expect(hash).not.toBe('hash-viejo');
    expect(await validatePasswordHash('nueva123', hash)).toBe(true);

    await expect(restablecerPasswordCliente('u1', '123')).rejects.toThrow(/al menos 6/);
  });

  it('actualizarClienteAdmin corrige nombre/correo y valida el correo', async () => {
    await actualizarClienteAdmin('u2', { nombre: 'Ana Pérez', email: 'ana.perez@correo.mx' });
    expect(__getAt('usuarios/u2/nombre')).toBe('Ana Pérez');
    expect(__getAt('usuarios/u2/email')).toBe('ana.perez@correo.mx');

    await expect(actualizarClienteAdmin('u2', { email: 'correo-malo' })).rejects.toThrow(/inválido/i);
  });
});
