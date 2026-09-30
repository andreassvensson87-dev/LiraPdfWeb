const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open("lirapdf", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("projects");
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
export async function readSaved() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("projects")
      .objectStore("projects")
      .get("current");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function writeSaved(value) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(value, "current");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function readBlockLibrary() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("projects")
      .objectStore("projects")
      .get("block-library");
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
export async function writeBlockLibrary(blocks) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(blocks, "block-library");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || Error("Biblioteket kunde inte sparas."));
  });
}
