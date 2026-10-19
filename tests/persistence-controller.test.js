import test from "node:test";
import assert from "node:assert/strict";
import { createPersistenceController } from "../src/app/persistence-controller.js";

function setup(overrides = {}) {
  const document = {
    id: "one",
    name: "One.pdf",
    bytes: new Uint8Array([1]),
    state: { entities: [], scales: {} },
    pageNo: 1,
    savedState: "{}",
  };
  const writes = [],
    statuses = [],
    notifications = [];
  const controller = createPersistenceController({
    workspace: { activeId: "one", restoring: false },
    documents: [document],
    stashDocument() {},
    writeSaved: async (snapshot) => writes.push(snapshot),
    status: (text) => statuses.push(text),
    notify: (text) => notifications.push(text),
    canUpdate: () => true,
    ...overrides,
  });
  return { controller, document, writes, statuses, notifications };
}

test("persistence writes immutable snapshots in order even when a write is pending", async () => {
  let release;
  const order = [];
  const { controller, document } = setup({
    writeSaved: async (snapshot) => {
      if (!order.length)
        await new Promise((resolve) => {
          release = resolve;
        });
      order.push(snapshot);
    },
  });
  const first = controller.flush();
  await new Promise((resolve) => setImmediate(resolve));
  document.name = "New.pdf";
  document.bytes[0] = 2;
  const second = controller.flush();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(
    order.map((snapshot) => snapshot.documents[0].name),
    ["One.pdf", "New.pdf"],
  );
  assert.deepEqual(
    order.map((snapshot) => snapshot.documents[0].bytes[0]),
    [1, 2],
  );
});

test("a failed save rejects app updates and does not poison later writes", async () => {
  let fail = true;
  const { controller, writes } = setup({
    writeSaved: async () => {
      if (fail) throw Error("Full");
      writes.push("saved");
    },
  });
  await assert.rejects(controller.prepareUpdate(), /Full/);
  fail = false;
  await controller.prepareUpdate();
  assert.deepEqual(writes, ["saved"]);
});

test("app update is blocked during active work and autosave is suppressed while restoring", async () => {
  const { controller, writes, statuses } = setup({
    workspace: { activeId: "one", restoring: true },
    canUpdate: () => false,
  });
  controller.autosave();
  assert.match(await controller.prepareUpdate(), /Avsluta/);
  assert.equal(writes.length, 0);
  assert.equal(statuses.length, 0);
});
