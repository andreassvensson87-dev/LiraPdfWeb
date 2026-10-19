import { pageRotation } from "../page-rotation.js";
import { createDocumentScroll } from "../document-scroll.js";
import { documentScrollMetrics, setupScrollbars } from "../scrollbars.js";

import { applyLineRemovals } from "../pdf-line-edit.js";

import { loadPdf } from "../pdf/viewer.js";

export function createPdfViewport({
  workspace,
  session,
  $,
  error,
  drawEntity,
  interaction,
  scrollToPosition,
  pdfDetail,
  paint,
}) {
  function displayedPage() {
    return pageRotation(
      workspace.viewport.width,
      workspace.viewport.height,
      session.state.rotations?.[workspace.pageNo] || 0,
    );
  }
  const documentScroll = createDocumentScroll($("viewport"), {
    changed: () => {
      if (!workspace.busy) view();
    },
    onError: error,
    drawAnnotations: (page, overlay) => {
      for (const entity of session.state.entities
        .filter((e) => e.page === page && e.type !== "pdfErase")
        .sort((a, b) => (a.type !== "viewport") - (b.type !== "viewport")))
        drawEntity(entity, false, overlay);
    },
    getPreviewPage: async (n) => {
      if (
        !session.state.entities.some(
          (e) => e.type === "pdfErase" && e.page === n,
        )
      )
        return { page: await workspace.pdf.getPage(n) };
      const edited = await loadPdf(
        await applyLineRemovals(workspace.bytes, session.state.entities),
      );
      try {
        return {
          page: await edited.getPage(n),
          release: () => edited.destroy(),
        };
      } catch (e) {
        await edited.destroy();
        throw e;
      }
    },
  });
  function scrollMetrics() {
    return workspace.viewport
      ? documentScrollMetrics(
          documentScroll.getLayout(),
          workspace.pageNo,
          workspace.pan,
          workspace.zoom,
          $("viewport").clientWidth,
          $("viewport").clientHeight,
        )
      : null;
  }
  const scrollbars = setupScrollbars({
    horizontal: $("horizontalScrollbar"),
    vertical: $("verticalScrollbar"),
    getMetrics: scrollMetrics,
    canScroll: () =>
      !!workspace.viewport &&
      (!workspace.busy || workspace.scrollLoading) &&
      !interaction.pendingDialog &&
      !interaction.drag &&
      !interaction.points.length &&
      !interaction.editOperation &&
      !interaction.activeGrip,
    scrollTo: scrollToPosition,
  });
  function view() {
    if (!workspace.viewport) return;
    const rotated = displayedPage();
    $("sheet").style.transform =
      `translate(${workspace.pan.x}px,${workspace.pan.y}px) scale(${workspace.zoom}) matrix(${rotated.matrix.join(",")})`;
    $("zoom").textContent = `${Math.round(workspace.zoom * 100)}%`;
    const corners = [
      {
        x: -workspace.pan.x / workspace.zoom,
        y: -workspace.pan.y / workspace.zoom,
      },
      {
        x: ($("viewport").clientWidth - workspace.pan.x) / workspace.zoom,
        y: ($("viewport").clientHeight - workspace.pan.y) / workspace.zoom,
      },
    ].map(rotated.inverse);
    const left = Math.min(...corners.map((p) => p.x)),
      top = Math.min(...corners.map((p) => p.y));
    pdfDetail.update({
      width: workspace.viewport.width,
      height: workspace.viewport.height,
      zoom: workspace.zoom,
      pan: { x: -left * workspace.zoom, y: -top * workspace.zoom },
      screenWidth: Math.abs(corners[1].x - corners[0].x) * workspace.zoom,
      screenHeight: Math.abs(corners[1].y - corners[0].y) * workspace.zoom,
      dpr: window.devicePixelRatio || 1,
    });
    paint();
    documentScroll.update({
      pdf: workspace.pdf,
      page: workspace.pageNo,
      pan: workspace.pan,
      zoom: workspace.zoom,
      rotations: session.state.rotations,
      revision: session.state,
    });
    scrollbars.update();
  }
  function fit() {
    if (!workspace.viewport) return;
    const dimensions = displayedPage();
    workspace.zoom = Math.min(
      ($("viewport").clientWidth - 70) / dimensions.width,
      ($("viewport").clientHeight - 55) / dimensions.height,
    );
    workspace.pan = {
      x: ($("viewport").clientWidth - dimensions.width * workspace.zoom) / 2,
      y: ($("viewport").clientHeight - dimensions.height * workspace.zoom) / 2,
    };
    view();
  }
  function fitAll() {
    if (!workspace.viewport) return;
    let left = 0,
      top = 0,
      right = workspace.viewport.width,
      bottom = workspace.viewport.height;
    for (const node of $("overlay").querySelectorAll("g.entity[data-id]")) {
      if (!node.dataset.id) continue;
      const r = node.getBBox();
      const entity = session.state.entities.find(
        (e) => e.id === node.dataset.id,
      );
      const margin = Math.max(4, (entity?.width || 0) / 2);
      left = Math.min(left, r.x - margin);
      top = Math.min(top, r.y - margin);
      right = Math.max(right, r.x + r.width + margin);
      bottom = Math.max(bottom, r.y + r.height + margin);
    }
    const rotatedBounds = [
      { x: left, y: top },
      { x: right, y: bottom },
    ].map(displayedPage().forward);
    left = Math.min(...rotatedBounds.map((p) => p.x));
    right = Math.max(...rotatedBounds.map((p) => p.x));
    top = Math.min(...rotatedBounds.map((p) => p.y));
    bottom = Math.max(...rotatedBounds.map((p) => p.y));
    const w = $("viewport").clientWidth,
      h = $("viewport").clientHeight;
    workspace.zoom = Math.min(
      (w - 70) / (right - left),
      (h - 55) / (bottom - top),
    );
    workspace.pan = {
      x: (w - (right - left) * workspace.zoom) / 2 - left * workspace.zoom,
      y: (h - (bottom - top) * workspace.zoom) / 2 - top * workspace.zoom,
    };
    view();
  }
  function zoomAt(
    f,
    x = $("viewport").clientWidth / 2,
    y = $("viewport").clientHeight / 2,
  ) {
    const next = Math.min(8, Math.max(0.1, workspace.zoom * f)),
      r = next / workspace.zoom;
    workspace.pan = {
      x: x - (x - workspace.pan.x) * r,
      y: y - (y - workspace.pan.y) * r,
    };
    workspace.zoom = next;
    view();
  }
  return {
    displayedPage,
    documentScroll,
    scrollbars,
    view,
    fit,
    fitAll,
    zoomAt,
    scrollMetrics,
  };
}
