import { toolCategories } from "./tool-catalog.js";

export function createToolController({
  closeObjectMenu,
  interaction,
  workspace,
  transformTools,
  editTypes,
  session,
  editPhase,
  clearTracking,
  presentTool,
  showCategory,
  refresh,
  rememberStyle,
  restoreStyle,
  showProperties,
}) {
  function setTool(t) {
    closeObjectMenu();
    interaction.activeGrip = null;
    if (workspace.busy || !workspace.pdf) return;
    if (!interaction.selection.size && interaction.tool !== "select")
      rememberStyle(interaction.tool);
    if (t !== "select") interaction.lastTool = t;
    const previousIds = [...interaction.selection];
    interaction.editOperation = transformTools.includes(t)
      ? {
          ids: previousIds.filter((id) =>
            editTypes(t).includes(
              session.state.entities.find((e) => e.id === id)?.type,
            ),
          ),
          phase: "select",
          amount: null,
        }
      : null;
    if (interaction.editOperation?.ids.length)
      interaction.editOperation.phase = editPhase(t);
    if (["fillet", "chamfer"].includes(t)) {
      interaction.editOperation.ids = [];
      interaction.editOperation.phase = "distance";
    }
    clearTracking();

    interaction.drag = null;
    interaction.tool = t;
    restoreStyle(t);
    if (t !== "select") showProperties();
    presentTool(t);
    if (toolCategories[t]) showCategory(toolCategories[t]);
    interaction.points = [];
    interaction.hover = null;
    interaction.selected = null;
    interaction.selection.clear();

    refresh();
  }

  function cancel() {
    interaction.activeGrip = null;
    clearTracking();
    interaction.drag = null;
    interaction.points = [];
    interaction.hover = null;
    interaction.selected = null;
    interaction.selection.clear();
    interaction.tool = "select";
    interaction.editOperation = null;
  }
  return { setTool, cancel };
}
