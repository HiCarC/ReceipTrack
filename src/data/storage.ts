// Lightweight IndexedDB wrapper for offline queue

const DB_NAME = 'receiptrack';
let DB_VERSION = 2;
const STORE = 'queue';

export type QueuedReceipt = {
  id: string; // local UUID
  userId: string;
  type: 'personal' | 'group';
  payload: any; // Firestore-ready receipt document
  imageDataUrl?: string; // optional image as data URL for portability
  status: 'queued' | 'processing' | 'done' | 'needs_fix';
  createdAt: number;
  error?: string;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // First try opening without specifying a version to avoid VersionError
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE)) {
        return resolve(db);
      }
      // Need to create store: bump version and create
      const nextVersion = (db.version || DB_VERSION) + 1;
      db.close();
      const up = indexedDB.open(DB_NAME, nextVersion);
      up.onupgradeneeded = () => {
        const udb = up.result;
        if (!udb.objectStoreNames.contains(STORE)) {
          const store = udb.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('by_user', 'userId');
          store.createIndex('by_status', 'status');
        }
      };
      up.onsuccess = () => resolve(up.result);
      up.onerror = () => reject(up.error);
    };
    req.onerror = () => {
      // On VersionError or others, retry with current DB_VERSION
      const err: any = req.error;
      if (err && err.name === 'VersionError') {
        try {
          const retry = indexedDB.open(DB_NAME, DB_VERSION);
          retry.onupgradeneeded = () => {
            const rdb = retry.result;
            if (!rdb.objectStoreNames.contains(STORE)) {
              const store = rdb.createObjectStore(STORE, { keyPath: 'id' });
              store.createIndex('by_user', 'userId');
              store.createIndex('by_status', 'status');
            }
          };
          retry.onsuccess = () => resolve(retry.result);
          retry.onerror = () => reject(retry.error);
          return;
        } catch (e) {
          return reject(e);
        }
      }
      reject(req.error);
    };
  });
}

export async function queueReceipt(entry: Omit<QueuedReceipt, 'status'|'createdAt'> & { status?: QueuedReceipt['status'] }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const data: QueuedReceipt = { ...entry, status: entry.status ?? 'queued', createdAt: Date.now() } as QueuedReceipt;
    store.put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueued(userId: string): Promise<QueuedReceipt[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const idx = store.index('by_user');
    const req = idx.getAll(IDBKeyRange.only(userId));
    req.onsuccess = () => resolve((req.result as QueuedReceipt[]).sort((a,b) => a.createdAt - b.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function updateStatus(id: string, status: QueuedReceipt['status'], error?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const get = store.get(id);
    get.onsuccess = () => {
      const val = get.result as QueuedReceipt;
      if (!val) return resolve();
      val.status = status;
      val.error = error;
      store.put(val);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeQueued(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


