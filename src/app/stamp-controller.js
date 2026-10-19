import { pdfStampFields, preparePdfStamp } from "../pdf-stamp.js";
import { loadPdf } from "../pdf/viewer.js";

export function createStampController({
  $,
  workspace,
  interaction,
  document,
  toast,
  error,
  base64,
  style,
  setTool,
}) {
  let pdfStampTemplate = null;
  $("loadPdfStamp").onclick = () => $("stampPdfInput").click();
  $("stampPdfInput").onchange = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file || workspace.busy || interaction.pendingDialog) return;
    try {
      workspace.busy = true;
      const data = new Uint8Array(await file.arrayBuffer()),
        fields = await pdfStampFields(data);
      pdfStampTemplate = {
        data,
        name: file.name.replace(/\.pdf$/i, ""),
        attributes: Object.fromEntries(fields.map((f) => [f.name, f.value])),
      };
      $("stampPdfFields").replaceChildren();
      for (const field of fields) {
        const label = document.createElement("label");
        label.textContent = field.name;
        const input = document.createElement("input");
        input.type = "text";
        input.value = field.value;
        input.setAttribute("aria-label", field.name);
        input.oninput = () =>
          (pdfStampTemplate.attributes[field.name] = input.value);
        label.append(input);
        $("stampPdfFields").append(label);
      }
      $("placePdfStamp").hidden = false;
      $("stampPdfSize").textContent = file.name + " · första sidan";
      toast(
        fields.length
          ? "Fyll i stämpelns fält och välj Placera PDF-stämpel."
          : "Välj Placera PDF-stämpel och klicka i ritningen.",
      );
    } catch (e) {
      error(e);
    } finally {
      workspace.busy = false;
    }
  };
  $("placePdfStamp").onclick = async () => {
    if (!pdfStampTemplate || workspace.busy || interaction.pendingDialog)
      return;
    let instance;
    try {
      workspace.busy = true;
      const stamp = await preparePdfStamp(
        pdfStampTemplate.data,
        pdfStampTemplate.attributes,
      );
      instance = await loadPdf(stamp.bytes);
      const page = await instance.getPage(1),
        viewport = page.getViewport({
          scale: Math.min(3, 1600 / Math.max(stamp.width, stamp.height)),
        }),
        canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        background: "rgba(0,0,0,0)",
      }).promise;
      interaction.pendingBlock = {
        type: "block",
        isPdfStamp: true,
        blockPdf: base64(stamp.bytes),
        preview: canvas.toDataURL("image/png"),
        blockName: pdfStampTemplate.name,
        naturalWidth: stamp.width,
        naturalHeight: stamp.height,
        blockWidth: stamp.width,
        blockHeight: stamp.height,
        rotation: 0,
        ...style(),
      };
      workspace.busy = false;
      setTool("block");
      toast(
        `Klicka för att placera PDF-stämpeln · ${((stamp.width * 25.4) / 72).toFixed(1)} × ${((stamp.height * 25.4) / 72).toFixed(1)} mm`,
      );
    } catch (e) {
      error(e);
    } finally {
      workspace.busy = false;
      await instance?.destroy();
    }
  };
}
