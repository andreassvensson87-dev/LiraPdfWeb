import { persistableFileHandle } from "../pdf-file-save.js";

// All automatic saves and app updates use the same ordered snapshot writer.
export function createPersistenceController({
  workspace,
  documents,
  stashDocument,
  writeSaved,
  status,
  notify,
  canUpdate,
  delay = 350,
}) {
  let timer;
  let writes = Promise.resolve();
  async function flush() {
    clearTimeout(timer);
    if (workspace.recoveryBlocked)
      throw Error(
        "Browserlagringen kunde inte läsas. Sparade data får inte ersättas.",
      );
    stashDocument();
    const snapshot = {
      version: 2,
      activeId: workspace.activeId,
      documents: [
        ...documents.map((document) => ({
          id: document.id,
          name: document.name,
          bytes: document.bytes.slice(),
          state: structuredClone(document.state),
          pageNo: document.pageNo,
          view: document.view ? structuredClone(document.view) : undefined,
          savedState: document.savedState,
          fileHandle: persistableFileHandle(document.fileHandle),
        })),
        ...(workspace.unrestoredDocuments || []).map((document) =>
          structuredClone(document),
        ),
      ],
    };
    writes = writes.catch(() => {}).then(() => writeSaved(snapshot));
    return writes;
  }
  function autosave() {
    if (workspace.restoring || workspace.recoveryBlocked) return;
    clearTimeout(timer);
    status("Sparar …");
    timer = setTimeout(async () => {
      try {
        await flush();
        status("Sparat i webbläsaren");
      } catch {
        status("Autosparande misslyckades");
        notify("Kunde inte autospara. Spara PDF:en.");
      }
    }, delay);
  }
  async function prepareUpdate() {
    if (!canUpdate())
      return "Avsluta eller avbryt pågående kommando före uppdatering.";
    await flush();
  }
  return { autosave, flush, prepareUpdate };
}
