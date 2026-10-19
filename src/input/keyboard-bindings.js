export function bindKeyboard({
  $,
  document,
  interaction,
  runCommand,
  history,
  remove,
  cancel,
  refresh,
}) {
  $("command").addEventListener("keydown", (ev) => {
    if (ev.isComposing || !["Enter", " "].includes(ev.key)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const value = ev.target.value;
    ev.target.value = "";
    runCommand(value);
    ev.target.blur();
  });
  window.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
      ev.preventDefault();
      if (!document.querySelector("dialog[open]"))
        $(ev.shiftKey ? "saveAs" : "save").click();
      return;
    }
    if (document.querySelector(".quick-tools-dialog[open]")) return;
    if (
      $("documentPicker").open ||
      $("closeDocumentDialog").open ||
      $("blockLibrary").open
    )
      return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName);
    if (ev.key === "Escape") {
      $("fileMenu").open = false;
      if (interaction.pendingDialog || $("newPdfDialog").open) return;
      cancel();
      $("command").value = "";
      $("command").blur();
      refresh();
      return;
    }
    if (typing || interaction.pendingDialog || $("newPdfDialog").open) return;
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      history(ev.shiftKey);
      return;
    }
    if (
      (ev.key === "Enter" || ev.key === " ") &&
      ev.target.closest("button, summary, a")
    )
      return;
    if (ev.key === "Enter") {
      ev.preventDefault();
      runCommand("");
      return;
    }
    if (ev.key === "F8") {
      ev.preventDefault();
      $("ortho").click();
    }
    if (ev.key === "F10" || ev.key === "F11") {
      ev.preventDefault();
      $(ev.key === "F10" ? "polar" : "otrack").click();
      return;
    }
    if (ev.key === " ") {
      ev.preventDefault();
      if (!interaction.space) interaction.spacePanned = false;
      interaction.space = true;
    }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      remove();
    }
    if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && ev.key !== " ") {
      $("command").focus();
      $("command").value = ev.key;
      ev.preventDefault();
    }
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.key === " ") {
      const repeat = interaction.space && !interaction.spacePanned;
      interaction.space = false;
      if (repeat && !/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName))
        runCommand("");
    }
  });
  window.addEventListener("blur", () => {
    interaction.space = false;
  });
}
