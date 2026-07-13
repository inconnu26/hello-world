// Persistance locale des sessions (livres) dans IndexedDB.
// Les photos sont volumineuses : IndexedDB est adapté (contrairement à localStorage).

const DB_NAME = 'bookscanner';
const DB_VERSION = 1;
const STORE = 'sessions';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error("IndexedDB indisponible sur ce navigateur"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const result = fn(store);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export async function getAllSessions() {
  return tx('readonly', (store) => {
    const out = [];
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        out.push(cursor.value);
        cursor.continue();
      }
    };
    return out;
  });
}

export async function putSession(session) {
  await tx('readwrite', (store) => store.put(session));
  return session;
}

export async function deleteSession(id) {
  return tx('readwrite', (store) => store.delete(id));
}
