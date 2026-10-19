// The browser adapter owns connections and transaction completion. Importing it
// does not open a database, and failed/aborted transactions never report success.
export function createIndexedDbRepository({
  indexedDB = globalThis.indexedDB,
  name = "lirapdf",
  store = "projects",
} = {}) {
  let connection = null,
    opening = null;
  function connect() {
    if (connection) return Promise.resolve(connection);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!indexedDB) {
        reject(Error("Browserlagring är inte tillgänglig."));
        return;
      }
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store))
          request.result.createObjectStore(store);
      };
      request.onerror = () =>
        reject(request.error || Error("Kunde inte öppna browserlagringen."));
      request.onsuccess = () => {
        connection = request.result;
        connection.onversionchange = () => {
          connection?.close();
          connection = null;
          opening = null;
        };
        resolve(connection);
      };
    }).catch((error) => {
      opening = null;
      throw error;
    });
    return opening;
  }
  async function transact(mode, execute) {
    const database = await connect();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(store, mode);
      let result;
      const request = execute(transaction.objectStore(store));
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        reject(transaction.error || Error("Lagringstransaktionen avbröts."));
      transaction.onerror = () =>
        reject(
          transaction.error ||
            request.error ||
            Error("Lagringstransaktionen misslyckades."),
        );
    });
  }
  return {
    read: (key) => transact("readonly", (objectStore) => objectStore.get(key)),
    write: (key, value) =>
      transact("readwrite", (objectStore) => objectStore.put(value, key)),
    close() {
      connection?.close();
      connection = null;
      opening = null;
    },
  };
}
