import { reorderDocuments } from "../model/document-list.js";
import { documentChanged, documentSnapshot } from "../document-state.js";
import { validateDocumentState } from "../model/document-validation.js";
import { pdfFilename } from "../pdf-file-save.js";

// Owns document lifetime and session transitions. PDF services, rendering and
// presentation are explicit ports, so this controller works without a DOM.
export function createDocumentController({
  documents,
  workspace,
  interaction,
  session,
  services,
  presentation,
  rendering,
  error,
  autosave,
  showPage,
  clone,
  toast,
  refresh,
  releaseDocument,
}) {
  function stashDocument() {
    const current = documents.find(
      (document) => document.id === workspace.activeId,
    );
    if (!current) return;
    Object.assign(current, {
      state: session.state,
      undoStack: session.undoStack,
      redoStack: session.redoStack,
      pageNo: workspace.pageNo,
      view: { zoom: workspace.zoom, pan: { ...workspace.pan } },
    });
  }
  function isChanged(document) {
    return documentChanged(
      document.id === workspace.activeId ? session.state : document.state,
      document.savedState,
    );
  }
  function renderDocuments() {
    presentation.render();
  }
  function reorder(id, targetId, after) {
    const ordered = reorderDocuments(documents, id, targetId, after);
    if (ordered === documents) return;
    documents.splice(0, documents.length, ...ordered);
    presentation.render({ revealActive: false });
    autosave();
  }
  async function activateDocument(id) {
    if (workspace.busy || interaction.pendingDialog) return false;
    const document = documents.find((candidate) => candidate.id === id);
    if (!document) return false;
    stashDocument();
    interaction.drag = interaction.activeGrip = null;
    Object.assign(workspace, {
      activeId: id,
      pdf: document.pdf,
      bytes: document.bytes,
      name: document.name,
    });
    Object.assign(session, {
      state: document.state,
      undoStack: document.undoStack,
      redoStack: document.redoStack,
      pageCount: document.pdf.numPages,
    });
    interaction.tool = "select";
    const savedView = document.view;
    if (savedView) {
      workspace.zoom = savedView.zoom;
      workspace.pan = { ...savedView.pan };
    }
    presentation.presentDocument(document.name);
    renderDocuments();
    await showPage(document.pageNo, !!savedView);
    return true;
  }
  async function openDocument(
    data,
    filename,
    project = null,
    fileHandle = null,
    { activate = true } = {},
  ) {
    if (workspace.busy || interaction.pendingDialog) return null;
    workspace.busy = true;
    presentation.status("Öppnar …");
    let instance,
      registered = false;
    try {
      if (project) validateDocumentState(project);
      if (!project) {
        const editable = await services.readEditablePdf(data);
        if (editable) {
          data = editable.bytes;
          project = editable.state;
        }
      }
      instance = await services.loadPdf(data);
      const state = project
        ? {
            entities: clone(project.entities),
            scales: clone(project.scales),
            rotations: clone(project.rotations || {}),
          }
        : { entities: [], scales: {} };
      validateDocumentState(state, { pageCount: instance.numPages });
      const document = {
        id: crypto.randomUUID(),
        pdf: instance,
        bytes: data.slice(),
        name: filename,
        fileHandle,
        state,
        undoStack: [],
        redoStack: [],
        pageNo: 1,
        savedState: documentSnapshot(state),
      };
      documents.push(document);
      registered = true;
      workspace.busy = false;
      if (activate) await activateDocument(document.id);
      return document;
    } finally {
      if (instance && !registered) await instance.destroy();
      workspace.busy = false;
    }
  }
  async function saveDocument(document, saveAs = false) {
    if (
      workspace.busy ||
      interaction.pendingDialog ||
      interaction.drag ||
      interaction.points.length ||
      interaction.editOperation ||
      interaction.activeGrip
    ) {
      toast("Avsluta eller avbryt pågående kommando före sparande.");
      return false;
    }
    if (!documents.includes(document)) return false;
    if (document.id === workspace.activeId) stashDocument();
    workspace.busy = true;
    presentation.saving(true);
    const snapshot = clone(document.state);
    try {
      const handle = await services.choosePdfTarget(
        document.fileHandle,
        document.name,
        saveAs,
      );
      presentation.status("Sparar PDF …");
      const result = await services.saveEditablePdf(
        document.bytes,
        snapshot,
        document.pdf,
      );
      if (handle) await services.writePdfFile(handle, result);
      else
        services.download(
          result,
          "application/pdf",
          pdfFilename(document.name),
        );
      document.fileHandle = handle;
      document.name = handle?.name || pdfFilename(document.name);
      if (document.id === workspace.activeId) {
        workspace.name = document.name;
        presentation.presentDocument(document.name);
      }
      document.savedState = documentSnapshot(snapshot);
      renderDocuments();
      autosave();
      toast(
        handle
          ? "PDF sparad."
          : "PDF hämtad. Den innehåller dina redigerbara markeringar.",
      );
      return true;
    } catch (exception) {
      if (exception.name !== "AbortError") error(exception);
      presentation.status(
        exception.name === "AbortError"
          ? "Sparande avbrutet"
          : "Sparande misslyckades",
      );
      return false;
    } finally {
      workspace.busy = false;
      presentation.saving(false);
    }
  }
  async function emptyWorkspace() {
    ++workspace.epoch;
    await rendering.clear();
    Object.assign(workspace, {
      activeId: null,
      pdf: null,
      bytes: null,
      viewport: null,
      pageNo: 0,
      pdfSegments: [],
      textItems: [],
      removableTextTargets: [],
    });
    Object.assign(session, {
      state: { entities: [], scales: {} },
      undoStack: [],
      redoStack: [],
      pageCount: undefined,
    });
    interaction.editOperation =
      interaction.activeGrip =
      interaction.selected =
      interaction.hover =
      interaction.snapHit =
      interaction.drag =
        null;
    interaction.points = [];
    interaction.selection.clear();
    interaction.tool = "select";
    rendering.updateScrollbars();
    presentation.presentEmpty();
    renderDocuments();
    refresh();
  }
  async function closeDocument(id) {
    if (workspace.busy || interaction.pendingDialog || !presentation.canClose())
      return false;
    stashDocument();
    const document = documents.find((candidate) => candidate.id === id);
    if (!document) return false;
    if (isChanged(document)) {
      const choice = await presentation.confirmClose(document.name);
      if (!["save", "discard"].includes(choice)) return false;
      if (choice === "save" && !(await saveDocument(document))) return false;
    }
    const index = documents.indexOf(document);
    if (index < 0) return false;
    documents.splice(index, 1);
    if (workspace.activeId === id) {
      if (documents.length)
        await activateDocument(
          documents[Math.min(index, documents.length - 1)].id,
        );
      else await emptyWorkspace();
    } else renderDocuments();
    autosave();
    try {
      await document.pdf.destroy();
    } finally {
      releaseDocument(id);
    }
    return true;
  }
  return {
    stashDocument,
    isChanged,
    reorder,
    renderDocuments,
    activateDocument,
    openDocument,
    saveDocument,
    emptyWorkspace,
    closeDocument,
  };
}
