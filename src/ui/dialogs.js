import { editCanvasText } from "../canvas-text-editor.js";
import { primitives } from "../model/entity-primitives.js";

export function createDialogs({ $, interaction, setTool, paint }) {
  function ask(title, help, value = "", numeric = false) {
    $("dialogTitle").textContent = title;
    $("dialogHelp").textContent = help;
    $("textInput").hidden = numeric;
    $("numberInput").hidden = !numeric;
    const input = $(numeric ? "numberInput" : "textInput");
    input.value = value;
    if (numeric) input.setAttribute("aria-label", title);
    return new Promise((resolve) => {
      interaction.pendingDialog = resolve;
      $("dialog").showModal();
      input.focus();
      input.select();
    });
  }
  $("cancelDialog").onclick = () => $("dialog").close("cancel");
  $("dialog").addEventListener("close", () => {
    const result =
      $("dialog").returnValue === "ok"
        ? $("numberInput").hidden
          ? $("textInput").value
          : $("numberInput").value
        : null;
    interaction.pendingDialog?.(result);
    interaction.pendingDialog = null;
  });
  $("circleShape").onchange = () => setTool($("circleShape").value);

  function canvasText(entity, initial = "") {
    const primitive = primitives({ ...entity, text: initial }, 1).find(
      (p) => p.kind === "text",
    );
    const point = primitive?.p || entity.points[0];
    interaction.inlineTextId = entity.id || null;
    paint();
    return new Promise((resolve) => {
      interaction.pendingDialog = resolve;
      editCanvasText({
        overlay: $("overlay"),
        point,
        fontSize: primitive?.size || entity.fontSize,
        color: entity.color,
        value: initial,
        singleLine: entity.type === "stamp",
        onFinish: (value) => {
          interaction.pendingDialog = null;
          interaction.inlineTextId = null;
          resolve(value);
          paint();
        },
        onSave: (saveAs) => $(saveAs ? "saveAs" : "save").click(),
      });
    });
  }

  return { ask, canvasText };
}
