import test from "node:test";
import assert from "node:assert/strict";
import { restoreWorkspace } from "../src/app/workspace-restoration.js";
import { createPersistenceController } from "../src/app/persistence-controller.js";

function setup(saved) {
  const workspace = {},
    documents = [],
    errors = [],
    writes = [];
  let active;
  const options = {
    workspace,
    documents,
    readSaved: async () => saved,
    demoPdf: async () => new Uint8Array([1]),
    openDocument: async (bytes, name, state) => {
      if (name === "broken.pdf") throw Error("Damaged PDF");
      const opened = {
        id: `opened-${name}`,
        name,
        bytes,
        state,
        pdf: { numPages: 2 },
      };
      documents.push(opened);
      return opened;
    },
    activateDocument: async (id) => {
      active = id;
    },
    emptyWorkspace: async () => {},
    autosave() {},
    error: (error) => errors.push(error),
  };
  const persistence = createPersistenceController({
    workspace,
    documents,
    stashDocument() {},
    writeSaved: async (value) => writes.push(value),
    status() {},
    notify() {},
    canUpdate: () => true,
  });
  return {
    workspace,
    documents,
    errors,
    options,
    persistence,
    writes,
    getActive: () => active,
  };
}
const snapshot = (name) => ({
  id: name,
  name,
  bytes: new Uint8Array([1]),
  state: { entities: [], scales: {} },
  pageNo: 2,
});

test("a failed document restore preserves the raw record while other documents remain usable", async () => {
  const broken = snapshot("broken.pdf"),
    valid = snapshot("valid.pdf");
  valid.view = { zoom: 2, pan: { x: -40, y: 30 } };
  const testCase = setup({
    version: 2,
    documents: [broken, valid],
    activeId: valid.id,
  });
  await restoreWorkspace(testCase.options);
  assert.equal(testCase.documents.length, 1);
  assert.equal(testCase.getActive(), "opened-valid.pdf");
  assert.equal(testCase.documents[0].pageNo, 2);
  assert.deepEqual(testCase.documents[0].view, valid.view);
  assert.deepEqual(testCase.workspace.unrestoredDocuments, [broken]);
  await testCase.persistence.flush();
  assert.deepEqual(testCase.writes[0].documents[1], broken);
  assert.equal(testCase.errors.length, 1);
});

test("failed storage reads and unsupported workspace formats cannot overwrite recovery data", async () => {
  for (const saved of [{ version: 999 }, undefined]) {
    const testCase = setup(saved);
    if (saved === undefined)
      testCase.options.readSaved = async () => {
        throw Error("Unavailable");
      };
    await restoreWorkspace(testCase.options);
    assert.equal(testCase.workspace.recoveryBlocked, true);
    assert.equal(testCase.workspace.restoring, false);
    await assert.rejects(testCase.persistence.flush(), /ersättas/);
    assert.equal(testCase.writes.length, 0);
  }
});
