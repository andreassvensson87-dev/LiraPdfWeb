import { tools } from "../editor/tool-catalog.js";
import { setupQuickTools } from "../quick-tools.js";

export function createQuickToolController({
  document,
  interaction,
  style,
  workspace,
  setTool,
  $,
  refresh,
  error,
  store,
}) {
  const quickToolBar = setupQuickTools({
    store,
    host: document.querySelector("main > .workspace"),
    tools: [...tools, ["ellipse", "", "Ellips", "EL"]].filter(([id]) =>
      [
        "freehand",
        "highlight",
        "cloud",
        "stamp",
        "line",
        "rect",
        "circle",
        "ellipse",
        "arc",
        "text",
        "leader",
      ].includes(id),
    ),
    current: () => ({ tool: interaction.tool, ...style() }),
    canUse: () =>
      !!workspace.pdf && !workspace.busy && !interaction.pendingDialog,
    activate: (preset) => {
      setTool(preset.tool);
      $("color").value = preset.color;
      $("width").value = preset.width;
      $("fontSize").value = preset.fontSize;
      $("transparency").value = Math.round((1 - (preset.opacity ?? 1)) * 100);
      refresh();
    },
    error,
  });

  return { quickToolBar };
}
