import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentController } from "../src/app/document-controller.js";
import { createWorkspaceState } from "../src/app/workspace-state.js";
import { documentSnapshot } from "../src/document-state.js";

function setup(overrides = {}) {
  const state = createWorkspaceState(),
    documents = [],
    events = [];
  const services = {
    readEditablePdf: async () => null,
    loadPdf: async () => ({
      numPages: 2,
      destroy: async () => events.push("destroy"),
    }),
    choosePdfTarget: async () => null,
    saveEditablePdf: async (_, snapshot) => {
      events.push(structuredClone(snapshot));
      return new Uint8Array([2]);
    },
    writePdfFile: async () => {},
    download: () => events.push("download"),
    ...overrides,
  };
  const presentation = {
    status() {},
    saving() {},
    render() {},
    presentDocument() {},
    presentEmpty() {},
    canClose: () => true,
    confirmClose: async () => "discard",
  };
  const controller = createDocumentController({
    ...state,
    documents,
    services,
    presentation,
    rendering: {
      clear: async () => events.push("clear"),
      updateScrollbars() {},
    },
    error: (error) => events.push(error),
    autosave() {},
    showPage: async (page) => {
      state.workspace.pageNo = page;
    },
    clone: structuredClone,
    toast() {},
    refresh() {},
    releaseDocument: () => events.push("release"),
  });
  return { ...state, documents, services, presentation, controller, events };
}
const project = { entities: [], scales: {} };

test("invalid imports leave the active session intact and release the rejected PDF", async () => {
  const { controller, documents, workspace, session, events } = setup();
  const opened = await controller.openDocument(
    new Uint8Array([1]),
    "one.pdf",
    project,
  );
  const before = session.state;
  await assert.rejects(
    controller.openDocument(new Uint8Array([1]), "bad.pdf", {
      ...project,
      scales: { 3: 1 },
    }),
    /sidor/,
  );
  assert.equal(documents.length, 1);
  assert.equal(workspace.activeId, opened.id);
  assert.equal(session.state, before);
  assert.equal(workspace.busy, false);
  assert.deepEqual(events, ["destroy"]);
});

test("document switching preserves independent camera, content and history", async () => {
  const { controller, workspace, session } = setup();
  const first = await controller.openDocument(
    new Uint8Array([1]),
    "first.pdf",
    project,
  );
  workspace.zoom = 2;
  workspace.pan = { x: -400, y: 20 };
  session.state = { entities: [], scales: { 1: 2 } };
  session.undoStack.push(project);
  const second = await controller.openDocument(
    new Uint8Array([1]),
    "second.pdf",
    project,
  );
  workspace.zoom = 0.5;
  workspace.pan = { x: 15, y: 40 };
  await controller.activateDocument(first.id);
  assert.equal(workspace.zoom, 2);
  assert.deepEqual(workspace.pan, { x: -400, y: 20 });
  assert.deepEqual(session.state.scales, { 1: 2 });
  assert.equal(session.undoStack.length, 1);
  assert.equal(session.pageCount, 2);
  await controller.activateDocument(second.id);
  assert.equal(workspace.zoom, 0.5);
  assert.equal(session.undoStack.length, 0);
});

test("save snapshots the active session and marks it saved only after successful output", async () => {
  const { controller, session, events, services } = setup();
  const opened = await controller.openDocument(
    new Uint8Array([1]),
    "one.pdf",
    project,
  );
  session.state = { entities: [], scales: { 1: 3 } };
  assert.equal(await controller.saveDocument(opened), true);
  assert.deepEqual(events[0].scales, { 1: 3 });
  assert.equal(opened.savedState, documentSnapshot(session.state));
  const saved = opened.savedState;
  session.state = { entities: [], scales: { 1: 4 } };
  services.saveEditablePdf = async () => {
    throw Error("Cannot save");
  };
  assert.equal(await controller.saveDocument(opened), false);
  assert.equal(opened.savedState, saved);
});

test("closing the last document clears rendering before destroying its PDF", async () => {
  const { controller, documents, workspace, session, events } = setup();
  const opened = await controller.openDocument(
    new Uint8Array([1]),
    "one.pdf",
    project,
  );
  assert.equal(await controller.closeDocument(opened.id), true);
  assert.deepEqual(events, ["clear", "destroy", "release"]);
  assert.equal(documents.length, 0);
  assert.equal(workspace.pdf, null);
  assert.equal(session.pageCount, undefined);
});

test("workspace restoration registers all saved views before activating a document", async () => {
  const { restoreWorkspace } =
    await import("../src/app/workspace-restoration.js");
  const { controller, documents, workspace } = setup();
  const snapshots = [
    {
      id: "first",
      name: "first.pdf",
      bytes: new Uint8Array([1]),
      state: project,
      pageNo: 2,
      view: { zoom: 2, pan: { x: -40, y: 30 } },
    },
    {
      id: "last",
      name: "last.pdf",
      bytes: new Uint8Array([1]),
      state: project,
      pageNo: 2,
      view: { zoom: 0.5, pan: { x: 10, y: -25 } },
    },
  ];
  await restoreWorkspace({
    workspace,
    documents,
    readSaved: async () => ({
      version: 2,
      documents: snapshots,
      activeId: "last",
    }),
    openDocument: controller.openDocument,
    activateDocument: controller.activateDocument,
    emptyWorkspace: controller.emptyWorkspace,
    autosave() {},
    error(exception) {
      throw exception;
    },
  });
  assert.equal(workspace.name, "last.pdf");
  assert.equal(workspace.pageNo, 2);
  assert.equal(workspace.zoom, 0.5);
  assert.deepEqual(workspace.pan, snapshots[1].view.pan);
  await controller.activateDocument(documents[0].id);
  assert.equal(workspace.pageNo, 2);
  assert.equal(workspace.zoom, 2);
  assert.deepEqual(workspace.pan, snapshots[0].view.pan);
});
