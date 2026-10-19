export function bindWorkspaceControls({
  $,
  fit,
  fitAll,
  zoomAt,
  history,
  remove,
  editText,
  setTool,
  interaction,
  clearTracking,
  refresh,
  toast,
  rotateCurrentPage,
}) {
  $("measureCalibrate").onclick = () => setTool("calibrate");
  $("rotatePageCW").onclick = () => rotateCurrentPage(90);
  $("rotatePageCCW").onclick = () => rotateCurrentPage(-90);
  $("viewport").addEventListener("dblclick", (event) => {
    if (event.target.closest(".page-navigation")) return;
    if (interaction.tool === "select") editText();
  });
  $("fit").onclick = fit;
  $("fitAll").onclick = fitAll;
  $("zoomIn").onclick = () => zoomAt(1.2);
  $("zoomOut").onclick = () => zoomAt(1 / 1.2);
  $("undo").onclick = () => history();
  $("redo").onclick = () => history(true);
  $("delete").onclick = remove;
  $("editText").onclick = editText;
  $("calibrate").onclick = () => setTool("calibrate");
  $("replace").onclick = () => setTool("replace");
  $("ortho").onclick = () => {
    interaction.ortho = !interaction.ortho;
    if (interaction.ortho) interaction.polar = false;
    clearTracking();
    refresh();
  };
  $("snap").onclick = () => {
    interaction.snap = !interaction.snap;
    clearTracking();
    refresh();
  };
  $("polar").onclick = () => {
    interaction.polar = !interaction.polar;
    if (interaction.polar) interaction.ortho = false;
    clearTracking();
    refresh();
  };
  $("otrack").onclick = () => {
    interaction.otrack = !interaction.otrack;
    clearTracking();
    refresh();
    if (interaction.otrack)
      toast(
        "Håll pekaren över en snappunkt en kort stund. Följ sedan dess vågräta eller lodräta hjälplinje.",
      );
  };
  $("polarAngle").onchange = () => {
    interaction.polarAngle = Number($("polarAngle").value);
    clearTracking();
    refresh();
  };
}

export function observeViewport({ viewport, hasPage, fit }) {
  const observer = new ResizeObserver(() => {
    if (hasPage()) fit();
  });
  observer.observe(viewport);
  return observer;
}
