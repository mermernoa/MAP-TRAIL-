/**
 * Petit stockage clé/valeur sur IndexedDB, pour les traces GPX importées
 * (trop volumineuses pour localStorage).
 */
const DB_NAME = 'take-ton-trail';
const STORE = 'tracks';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>('readonly', (s) => s.get(key));
}

export function idbSet(key: string, value: unknown): Promise<void> {
  return run<void>('readwrite', (s) => s.put(value, key));
}

export function idbDelete(key: string): Promise<void> {
  return run<void>('readwrite', (s) => s.delete(key));
}
