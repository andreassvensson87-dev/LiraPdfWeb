import { OPS } from "pdfjs-dist";
import { loadPdf } from "../pdf/viewer.js";
import { applyLineRemovals } from "../pdf-line-edit.js";
import { textRemovalTargets } from "../pdf-text-edit.js";
import { extractSegments } from "../pdf-snapping.js";

// Owns raster jobs and temporary PDF instances. It never changes a session,
// selection, tool, document tab or storage status.
export function createPageRenderer({ canvas, sheet, overlay, pdfDetail }) {
  let task = null,
    generation = 0;
  const segments = new WeakMap();
  async function cancel() {
    generation++;
    const previous = task;
    task = null;
    previous?.cancel();
    await Promise.all([previous?.promise.catch(() => {}), pdfDetail.clear()]);
  }
  async function render({ pdf, bytes, entities, pageNumber, isCurrent }) {
    const ticket = generation + 1;
    await cancel();
    const active = () => ticket === generation && isCurrent();
    let modified;
    try {
      if (!active()) return null;
      if (entities.some((entity) => entity.type === "pdfErase"))
        modified = await loadPdf(await applyLineRemovals(bytes, entities));
      if (!active()) return null;
      const page = await (modified || pdf).getPage(pageNumber);
      if (!active()) return null;
      const viewport = page.getViewport({ scale: 1 });
      if (!segments.has(page))
        segments.set(
          page,
          extractSegments(
            await page.getOperatorList(),
            OPS,
            viewport.transform,
          ),
        );
      if (!active()) return null;
      const scale = Math.min(
        2,
        Math.sqrt(16000000 / (viewport.width * viewport.height)),
        8192 / Math.max(viewport.width, viewport.height),
      );
      const raster = page.getViewport({ scale });
      canvas.width = Math.ceil(raster.width);
      canvas.height = Math.ceil(raster.height);
      sheet.style.width = `${viewport.width}px`;
      sheet.style.height = `${viewport.height}px`;
      overlay.setAttribute(
        "viewBox",
        `0 0 ${viewport.width} ${viewport.height}`,
      );
      const rendering = page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: raster,
      });
      task = rendering;
      await rendering.promise;
      if (task === rendering) task = null;
      if (!active()) return null;
      const { items } = await page.getTextContent();
      if (!active()) return null;
      const targets = await textRemovalTargets(
        bytes,
        pageNumber,
        items,
        viewport,
      );
      if (!active()) return null;
      const source = modified;
      pdfDetail.setPage(page, source ? () => source.destroy() : null);
      modified = null;
      return {
        viewport,
        segments: segments.get(page),
        textItems: items,
        removableTextTargets: targets.filter(
          (target) =>
            !entities.some(
              (entity) =>
                entity.type === "pdfErase" &&
                entity.page === pageNumber &&
                entity.eraseTextOffset === target.offset,
            ),
        ),
      };
    } finally {
      await modified?.destroy();
    }
  }
  return { render, cancel };
}
