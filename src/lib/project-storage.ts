export type StoredClip = { id: string; rank: number; name: string; file: File | null; duration: number; start: number; end: number; label: string };
export type StoredProject = { id: string; name: string; createdAt: number; updatedAt: number; clipCount: number; title: string; titleColors: string[]; clips: StoredClip[] };

const DB_NAME = "rankcut-workspace";
const STORE_NAME = "projects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open project storage"));
  });
}

export async function saveStoredProject(project: StoredProject): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save project"));
    tx.onabort = () => reject(tx.error ?? new Error("Project save was cancelled"));
  });
  db.close();
}

export async function listStoredProjects(): Promise<StoredProject[]> {
  const db = await openDb();
  const projects = await new Promise<StoredProject[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as StoredProject[]).sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error ?? new Error("Could not list projects"));
  });
  db.close();
  return projects;
}

export async function getStoredProject(id: string): Promise<StoredProject | undefined> {
  const db = await openDb();
  const project = await new Promise<StoredProject | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredProject | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not open project"));
  });
  db.close();
  return project;
}
