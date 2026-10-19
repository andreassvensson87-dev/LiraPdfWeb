import { blankPdf } from "../blank-pdf.js";
import { mmPerPoint } from "../viewports.js";

export function createNewDocumentController({
  $,
  workspace,
  interaction,
  openDocument,
  error,
}) {
  $("newPdf").onclick = () => {
    if (workspace.busy || interaction.pendingDialog) return;
    $("newPdfDialog").showModal();
  };
  $("newPdfForm").onsubmit = async (event) => {
    event.preventDefault();
    $("newPdfDialog").close();
    try {
      const data = await blankPdf(
        $("paperSize").value,
        $("paperOrientation").value === "landscape",
      );
      const filename =
        ($("newPdfName").value.trim() || "Ny ritning").replace(/\.pdf$/i, "") +
        ".pdf";
      await openDocument(data, filename, {
        entities: [],
        scales: { 1: mmPerPoint },
      });
    } catch (e) {
      error(e);
    }
  };
  $("cancelNewPdf").onclick = () => $("newPdfDialog").close();
}
