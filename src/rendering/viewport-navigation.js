import { scrollPosition } from "../document-layout.js";

export function createViewportNavigation({
  workspace,
  interaction,
  documentScroll,
  showPage,
  view,
  $,
  scrollMetrics,
  zoomAt,
}) {
  function scrollToPosition(position) {
    if (workspace.scrollLoading) {
      workspace.queuedScrollbarPosition = {
        ...workspace.queuedScrollbarPosition,
        ...position,
      };
      workspace.queuedScroll = { x: 0, y: 0 };
      return;
    }
    const metrics = scrollMetrics();
    if (!metrics) return;
    const delta = (axis) =>
      position[axis] === undefined
        ? 0
        : position[axis] * metrics[axis].range - metrics[axis].offset;
    scrollDocument(delta("x"), delta("y"));
  }
  async function scrollDocument(dx, dy) {
    if (workspace.scrollLoading) {
      workspace.queuedScroll.x += dx;
      workspace.queuedScroll.y += dy;
      return;
    }
    const layout = documentScroll.getLayout();
    if (!layout.length) {
      workspace.pan = { x: workspace.pan.x - dx, y: workspace.pan.y - dy };
      view();
      return;
    }
    const position = scrollPosition(
      layout,
      workspace.pageNo,
      workspace.pan,
      workspace.zoom,
      dx,
      dy,
      $("viewport").clientHeight,
    );
    workspace.pan = position.currentPan;
    view();
    if (position.page === workspace.pageNo) return;
    workspace.scrollLoading = true;
    try {
      await showPage(position.page, true, position.pan);
    } finally {
      workspace.scrollLoading = false;
      const queued = workspace.queuedScroll;
      workspace.queuedScroll = { x: 0, y: 0 };
      const position = workspace.queuedScrollbarPosition;
      workspace.queuedScrollbarPosition = {};
      if (Object.keys(position).length) scrollToPosition(position);
      else if (queued.x || queued.y) scrollDocument(queued.x, queued.y);
    }
  }
  $("viewport").addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      if (
        !workspace.viewport ||
        (workspace.busy && !workspace.scrollLoading) ||
        interaction.pendingDialog ||
        interaction.drag
      )
        return;
      const r = $("viewport").getBoundingClientRect();
      const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? r.height : 1;
      if (ev.ctrlKey) {
        if (workspace.busy) return;
        zoomAt(
          Math.exp(-ev.deltaY * unit * 0.0015),
          ev.clientX - r.left,
          ev.clientY - r.top,
        );
        return;
      }
      if (
        interaction.points.length ||
        interaction.editOperation ||
        interaction.activeGrip
      )
        return;
      const dx = (ev.shiftKey && !ev.deltaX ? ev.deltaY : ev.deltaX) * unit;
      const dy = (ev.shiftKey ? 0 : ev.deltaY) * unit;
      scrollDocument(dx, dy);
    },
    { passive: false },
  );

  return { scrollToPosition, scrollDocument };
}
