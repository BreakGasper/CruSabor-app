/**
 * Mock en memoria de `firebase/database` con la superficie que usa la app:
 * ref, child, get, set, update, push, query/orderByChild/equalTo, onValue, runTransaction.
 * Los datos viven en un árbol JSON accesible por rutas "a/b/c".
 */
import { vi } from 'vitest';

type Tree = Record<string, any>;
let tree: Tree = {};
const listeners = new Map<string, Set<(snap: any) => void>>();

export function __reset(data: Tree = {}) {
  tree = JSON.parse(JSON.stringify(data));
  listeners.clear();
}
export function __getTree(): Tree {
  return JSON.parse(JSON.stringify(tree));
}
export function __getAt(path: string) {
  return getAt(path);
}

const segs = (p: string) => p.split('/').filter(Boolean);

function getAt(path: string) {
  let node: any = tree;
  for (const s of segs(path)) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[s];
  }
  return node === undefined ? undefined : JSON.parse(JSON.stringify(node));
}

function setAt(path: string, value: any) {
  const parts = segs(path);
  if (!parts.length) {
    tree = value ?? {};
    return notify('');
  }
  let node: any = tree;
  for (const s of parts.slice(0, -1)) {
    if (node[s] == null || typeof node[s] !== 'object') node[s] = {};
    node = node[s];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) delete node[last];
  else node[last] = JSON.parse(JSON.stringify(value));
  notify(path);
}

function notify(changedPathRaw: string) {
  // update(ref(db), { 'tiendas/x/y': v }) produce rutas con "/" inicial; se normalizan
  const changedPath = segs(changedPathRaw).join('/');
  for (const [path, set] of listeners) {
    if (changedPath.startsWith(path) || path.startsWith(changedPath)) {
      set.forEach((cb) => cb(snapshot(path)));
    }
  }
}

interface RefLike {
  __path: string;
  __filter?: { child: string; value: any };
}

function snapshot(path: string, filter?: RefLike['__filter']) {
  let val = getAt(path);
  if (filter && val && typeof val === 'object') {
    val = Object.fromEntries(
      Object.entries(val).filter(([, v]: any) => v?.[filter.child] === filter.value),
    );
    if (!Object.keys(val).length) val = undefined;
  }
  return { exists: () => val !== undefined, val: () => (val === undefined ? null : val) };
}

let pushCounter = 0;

export const ref = vi.fn((_db: any, path = ''): RefLike => ({ __path: path }));
export const child = vi.fn((r: RefLike, path: string): RefLike => ({
  __path: [r.__path, path].filter(Boolean).join('/'),
}));
export const get = vi.fn(async (r: RefLike) => snapshot(r.__path, r.__filter));
export const set = vi.fn(async (r: RefLike, value: any) => setAt(r.__path, value));
export const update = vi.fn(async (r: RefLike, partial: Record<string, any>) => {
  for (const [k, v] of Object.entries(partial)) setAt(`${r.__path}/${k}`, v);
});
export const remove = vi.fn(async (r: RefLike) => setAt(r.__path, null));
export const push = vi.fn((r: RefLike, value?: any): RefLike & { key: string } => {
  const key = `-MOCK${String(++pushCounter).padStart(4, '0')}`;
  const path = `${r.__path}/${key}`;
  if (value !== undefined) setAt(path, value); // push(ref, valor) escribe directamente
  return { __path: path, key };
});
export const orderByChild = vi.fn((childKey: string) => ({ __orderBy: childKey }));
export const equalTo = vi.fn((value: any) => ({ __equalTo: value }));
export const query = vi.fn((r: RefLike, ...constraints: any[]): RefLike => {
  const ob = constraints.find((c) => c?.__orderBy);
  const eq = constraints.find((c) => '__equalTo' in (c || {}));
  return { __path: r.__path, __filter: ob && eq ? { child: ob.__orderBy, value: eq.__equalTo } : undefined };
});
export const onValue = vi.fn((r: RefLike, cb: (snap: any) => void, _opts?: any) => {
  const wrapped = () => cb(snapshot(r.__path, r.__filter));
  if (!listeners.has(r.__path)) listeners.set(r.__path, new Set());
  listeners.get(r.__path)!.add(wrapped);
  wrapped();
  return () => listeners.get(r.__path)?.delete(wrapped);
});
export const runTransaction = vi.fn(async (r: RefLike, fn: (current: any) => any) => {
  const current = getAt(r.__path);
  const next = fn(current === undefined ? null : current);
  if (next === undefined) return { committed: false, snapshot: snapshot(r.__path) };
  setAt(r.__path, next);
  return { committed: true, snapshot: snapshot(r.__path) };
});
export const getDatabase = vi.fn(() => ({}));
export type Unsubscribe = () => void;
