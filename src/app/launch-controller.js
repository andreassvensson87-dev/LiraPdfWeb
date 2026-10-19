import { restoreWorkspace } from "./workspace-restoration.js";
import { setupFileHandling } from "../file-handling.js";
import { setupPdfDrop } from "../pdf-drop.js";

import { demoPdf } from "../pdf/demo-document.js";
import { readSaved } from "../storage.js";

export function createLaunchController({
  workspace,
  openDocument,
  documents,
  activateDocument,
  emptyWorkspace,
  autosave,
  error,
  interaction,
  document,
  toast,
}) {
  const startup = restoreWorkspace({
    workspace,
    documents,
    readSaved,
    demoPdf,
    openDocument,
    activateDocument,
    emptyWorkspace,
    autosave,
    error,
  });
  const incomingPdfOptions = {
    ready: startup,
    canOpen: () =>
      !workspace.busy &&
      !workspace.restoring &&
      !interaction.pendingDialog &&
      !document.querySelector("dialog[open]") &&
      !interaction.drag &&
      !interaction.points.length &&
      !interaction.editOperation &&
      !interaction.activeGrip,
    open: (data, name, handle) => openDocument(data, name, null, handle),
    error,
    waiting: () =>
      toast(
        "En PDF väntar på att öppnas. Avsluta kommandot eller dialogen först.",
      ),
  };
  setupFileHandling(incomingPdfOptions);
  setupPdfDrop(incomingPdfOptions);

  return { startup };
}
