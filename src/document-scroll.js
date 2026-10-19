import { pageLayout } from "./document-layout.js";
export { pageLayout, scrollPosition } from "./document-layout.js";

// Keep only visible neighbouring pages rasterized; the active page stays editable.
export function createDocumentScroll(
  host,
  { changed, drawAnnotations, getPreviewPage, onError },
) {
  let source,
    sizes = [],
    generation = 0,
    failed = false;
  const previews = new Map();
  let layout = [];

  function clear() {
    generation++;
    for (const preview of previews.values()) {
      preview.task?.cancel();
      preview.node.remove();
    }
    previews.clear();
    sizes = [];
    layout = [];
    source = null;
    failed = false;
  }

  async function initialize(pdf) {
    clear();
    source = pdf;
    const token = generation;
    try {
      const next = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        if (token !== generation) return;
        const { width, height } = page.getViewport({ scale: 1 });
        next.push({ width, height });
      }
      sizes = next;
      changed();
    } catch (error) {
      if (token === generation) {
        failed = true;
        onError(error);
      }
    }
  }

  async function render(preview, item, token, zoom) {
    let release;
    try {
      const result = await getPreviewPage(item.page);
      release = result.release;
      if (token !== generation || previews.get(item.page) !== preview) return;
      const scale = Math.min(
        1.5,
        zoom * (window.devicePixelRatio || 1),
        Math.sqrt(2000000 / (item.size.width * item.size.height)),
        4096 / Math.max(item.size.width, item.size.height),
      );
      const vp = result.page.getViewport({ scale });
      const canvas = preview.node.querySelector("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      preview.task = result.page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: vp,
      });
      await preview.task.promise;
    } catch (error) {
      if (token === generation && error.name !== "RenderingCancelledException")
        onError(error);
    } finally {
      await release?.();
    }
  }

  function update({ pdf, page, pan, zoom, rotations, revision }) {
    if (!pdf) {
      if (source) clear();
      return;
    }
    if (source !== pdf) {
      initialize(pdf);
      return;
    }
    if (!sizes.length || failed) return;
    layout = pageLayout(sizes, rotations);
    const anchor = layout[page - 1];
    const visible = new Set();
    for (const item of layout) {
      const y = pan.y + (item.top - anchor.top) * zoom;
      if (
        item.page === page ||
        y > host.clientHeight + 100 ||
        y + item.height * zoom < -100
      )
        continue;
      visible.add(item.page);
      let preview = previews.get(item.page);
      if (preview && preview.revision !== revision) {
        preview.task?.cancel();
        preview.node.remove();
        previews.delete(item.page);
        preview = null;
      }
      if (!preview) {
        const node = document.createElement("div");
        node.className = "document-page-preview";
        node.dataset.page = item.page;
        const canvas = document.createElement("canvas");
        const overlay = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        overlay.setAttribute(
          "viewBox",
          `0 0 ${item.size.width} ${item.size.height}`,
        );
        node.append(canvas, overlay);
        host.prepend(node);
        preview = { node, revision };
        previews.set(item.page, preview);
        drawAnnotations(item.page, overlay);
        render(preview, item, generation, zoom);
      }
      preview.node.style.width = `${item.size.width}px`;
      preview.node.style.height = `${item.size.height}px`;
      const x = pan.x + ((anchor.width - item.width) * zoom) / 2;
      preview.node.style.transform = `translate(${x}px,${y}px) scale(${zoom}) matrix(${item.matrix.join(",")})`;
    }
    for (const [n, preview] of previews) {
      if (visible.has(n)) continue;
      preview.task?.cancel();
      preview.node.remove();
      previews.delete(n);
    }
  }

  return { update, clear, getLayout: () => layout };
}
