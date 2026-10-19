import { validateProject } from "../model/project-format.js";
import { demoPdf } from "../pdf/demo-document.js";
import { exportPdf } from "../export.js";

export function createFileController({
  $,
  workspace,
  interaction,
  openDocument,
  error,
  stashDocument,
  documents,
  saveDocument,
  clone,
  session,
  download,
  toast,
}) {
  $("open").onclick = async () => {
    if (workspace.busy || interaction.pendingDialog) return;
    if (!window.showOpenFilePicker) {
      $("pdfInput").click();
      return;
    }
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "PDF-dokument",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      for (const handle of handles) {
        const file = await handle.getFile();
        await openDocument(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
          null,
          handle,
        );
      }
    } catch (e) {
      if (e.name !== "AbortError") error(e);
    }
  };
  $("projectOpen").onclick = () => $("projectInput").click();
  $("pdfInput").onchange = async (ev) => {
    for (const file of ev.target.files)
      try {
        await openDocument(new Uint8Array(await file.arrayBuffer()), file.name);
      } catch (e) {
        error(e);
      }
    ev.target.value = "";
  };
  $("projectInput").onchange = async (ev) => {
    const file = ev.target.files[0];
    if (file)
      try {
        const p = validateProject(JSON.parse(await file.text()));
        await openDocument(
          Uint8Array.from(atob(p.pdf), (c) => c.charCodeAt(0)),
          p.name || "Ritning.pdf",
          p,
        );
      } catch (e) {
        error(e);
      }
    ev.target.value = "";
  };
  $("save").onclick = () => {
    stashDocument();
    const d = documents.find((d) => d.id === workspace.activeId);
    if (d) saveDocument(d);
  };
  $("saveAs").onclick = () => {
    stashDocument();
    const d = documents.find((d) => d.id === workspace.activeId);
    if (d) saveDocument(d, true);
  };
  $("export").onclick = async () => {
    if (!workspace.pdf || workspace.busy) return;
    $("export").disabled = true;
    try {
      const exportName = workspace.name;
      const result = await exportPdf(
        workspace.bytes,
        clone(session.state.entities),
        clone(session.state.scales),
        workspace.pdf,
        clone(session.state.rotations || {}),
      );
      download(
        result,
        "application/pdf",
        exportName.replace(/\.pdf$/i, "") + "-markerad.pdf",
      );
      toast(
        "Visningskopia exporterad. Använd Spara PDF för att behålla redigerbara markeringar.",
      );
    } catch (e) {
      error(e);
    } finally {
      $("export").disabled = false;
    }
  };
  $("demo").onclick = async () => {
    try {
      await openDocument(await demoPdf(), "Exempelritning.pdf");
    } catch (e) {
      error(e);
    }
  };
}
