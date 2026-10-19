import test from "node:test";
import assert from "node:assert/strict";
import { createIndexedDbRepository } from "../src/infrastructure/indexeddb-repository.js";

function fakeDatabase() {
  const transactions = [],
    opens = [],
    values = new Map();
  const database = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction(_, mode) {
      const transaction = {
        mode,
        objectStore: () => ({
          get(key) {
            transaction.request = {};
            transaction.value = values.get(key);
            return transaction.request;
          },
          put(value, key) {
            transaction.request = {};
            transaction.value = key;
            transaction.write = () => values.set(key, value);
            return transaction.request;
          },
        }),
      };
      transactions.push(transaction);
      return transaction;
    },
  };
  const indexedDB = {
    open() {
      const request = {};
      opens.push(request);
      return request;
    },
  };
  return { indexedDB, database, transactions, opens, values };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("the repository opens lazily and resolves writes only at transaction completion", async () => {
  const mock = fakeDatabase(),
    repository = createIndexedDbRepository({ indexedDB: mock.indexedDB });
  assert.equal(mock.opens.length, 0);
  let resolved = false;
  const pending = repository.write("key", "value").then(() => {
    resolved = true;
  });
  assert.equal(mock.opens.length, 1);
  mock.opens[0].result = mock.database;
  mock.opens[0].onsuccess();
  await tick();
  const transaction = mock.transactions[0];
  transaction.request.onsuccess();
  await tick();
  assert.equal(resolved, false);
  transaction.write();
  transaction.oncomplete();
  await pending;
  assert.equal(mock.values.get("key"), "value");
});

test("an abort after request success is rejected and a failed database opening can retry", async () => {
  const mock = fakeDatabase(),
    repository = createIndexedDbRepository({ indexedDB: mock.indexedDB });
  const failed = repository.read("key");
  mock.opens[0].error = Error("Cannot open");
  mock.opens[0].onerror();
  await assert.rejects(failed, /Cannot open/);
  const next = repository.write("key", "value");
  mock.opens[1].result = mock.database;
  mock.opens[1].onsuccess();
  await tick();
  const transaction = mock.transactions[0];
  transaction.request.onsuccess();
  transaction.onabort();
  await assert.rejects(next, /avbröts/);
  assert.equal(mock.values.has("key"), false);
});
