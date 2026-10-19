// Coordinates a page transition. Rendering is an injected service; UI and
// persistence are effects supplied by the application composition.
export function createPageController({
  workspace,
  interaction,
  session,
  renderer,
  closeObjectMenu,
  clearTracking,
  prepareMarkupPreviews,
  presentPage,
  refresh,
  view,
  fit,
  refreshLibrary,
  autosave,
  error,
}) {
  async function showPage(number, keepView = false, pan = null) {
    if (
      !workspace.pdf ||
      interaction.pendingDialog ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > workspace.pdf.numPages
    )
      return false;
    closeObjectMenu();
    interaction.drag = null;
    interaction.activeGrip = null;
    clearTracking();
    if (interaction.editOperation) interaction.tool = "select";
    interaction.editOperation = null;
    const token = ++workspace.epoch;
    workspace.busy = true;
    workspace.pdfSegments = [];
    workspace.textItems = [];
    workspace.removableTextTargets = [];
    workspace.pageNo = number;
    interaction.snapHit = interaction.selected = interaction.hover = null;
    interaction.points = [];
    interaction.selection.clear();
    const isCurrent = () => token === workspace.epoch;
    try {
      await renderer.cancel();
      await prepareMarkupPreviews();
      if (!isCurrent()) return false;
      const result = await renderer.render({
        pdf: workspace.pdf,
        bytes: workspace.bytes,
        entities: session.state.entities,
        pageNumber: number,
        isCurrent,
      });
      if (!isCurrent() || !result) return false;
      workspace.viewport = result.viewport;
      workspace.pdfSegments = result.segments;
      workspace.textItems = result.textItems;
      workspace.removableTextTargets = result.removableTextTargets;
      presentPage(number, workspace.pdf.numPages);
      if (pan) workspace.pan = pan;
      if (keepView) view();
      else fit();
      refresh();
      return true;
    } catch (exception) {
      if (isCurrent() && exception.name !== "RenderingCancelledException")
        error(exception);
      return false;
    } finally {
      if (isCurrent()) {
        workspace.busy = false;
        view();
        refreshLibrary();
        autosave();
      }
    }
  }
  return { showPage };
}
