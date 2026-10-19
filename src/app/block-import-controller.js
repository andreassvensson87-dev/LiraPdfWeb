import { blockPage } from "../pdf-block.js";
import { loadPdf } from "../pdf/viewer.js";

export function createBlockImportController({
  $,
  workspace,
  interaction,
  ask,
  document,
  base64,
  style,
  library,
  toast,
  error,
}) {
  $("blockInput").onchange = async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file || workspace.busy || interaction.pendingDialog) return;
    let source, normalized;
    try {
      workspace.busy = true;
      const data = new Uint8Array(await file.arrayBuffer());
      source = await loadPdf(data);
      const answer =
        source.numPages > 1
          ? await ask(
              "Välj sida till PDF-block",
              `PDF:en har ${source.numPages} sidor. Ange sidnummer.`,
              "1",
              true,
            )
          : "1";
      if (answer === null) return;
      const n = Number(answer);
      if (!Number.isInteger(n) || n < 1 || n > source.numPages)
        throw Error("Sidnumret finns inte i PDF:en.");
      const block = await blockPage(data, n);
      normalized = await loadPdf(block.bytes);
      const page = await normalized.getPage(1);
      const vp = page.getViewport({
        scale: Math.min(3, 1600 / Math.max(block.width, block.height)),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: vp,
        background: "rgba(0,0,0,0)",
      }).promise;
      const scale = Math.min(
        1,
        ((workspace.viewport?.width || block.width * 2.5) * 0.4) / block.width,
        ((workspace.viewport?.height || block.height * 2.5) * 0.4) /
          block.height,
      );
      const importedBlock = {
        type: "block",
        blockPdf: base64(block.bytes),
        preview: canvas.toDataURL("image/png"),
        blockName:
          file.name.replace(/\.pdf$/i, "") +
          (source.numPages > 1 ? ` · sida ${n}` : ""),
        naturalWidth: block.width,
        naturalHeight: block.height,
        blockWidth: block.width * scale,
        blockHeight: block.height * scale,
        rotation: 0,
        ...style(),
      };
      await library.add(importedBlock);
      workspace.busy = false;
      await library.open();
      toast("Blocket är sparat i biblioteket.");
    } catch (e) {
      error(e);
    } finally {
      workspace.busy = false;
      await source?.destroy();
      await normalized?.destroy();
    }
  };
}
