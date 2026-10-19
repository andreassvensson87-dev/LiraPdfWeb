import { names } from "../editor/tool-catalog.js";

export function createWorkspacePresenter({
  updateQuickTools,
  shell,
  workspace,
  interaction,
  $,
  current,
  session,
  prompt,
  paint,
  document,
}) {
  function refresh() {
    updateQuickTools();

    $("toolname").textContent =
      interaction.selection.size > 1
        ? `${interaction.selection.size} objekt`
        : current()?.type === "pdfMarkup"
          ? current().label
          : names[current()?.type || interaction.tool];
    const activeType = current()?.type || interaction.tool;
    $("pdfStampControls").hidden = interaction.tool !== "stamp" || !!current();
    $("stampControl").hidden = interaction.tool !== "stamp" || !!current();
    $("circleShapeControl").hidden =
      !!current() || !["circle", "ellipse"].includes(interaction.tool);
    const hasStyle =
      activeType !== "pdfMarkup" &&
      activeType !== "viewport" &&
      activeType !== "block" &&
      activeType !== "select" &&
      activeType !== "calibrate" &&
      !(activeType === "mask" && !current()) &&
      !["extract", "coverLine", "eraseLine", "eraseText"].includes(activeType);
    $("viewportControls").hidden = current()?.type !== "viewport";
    if (current()?.type === "viewport") {
      $("viewportScale").value = current().denominator;
      $("viewportName").value = current().name || "Viewport";
      $("viewportLabel").checked = !!current().showLabel;
    }
    $("blockControls").hidden = current()?.type !== "block";
    if (current()?.type === "block") {
      $("blockSize").value = (
        (current().blockWidth / current().naturalWidth) *
        100
      ).toFixed(1);
      $("blockRotation").value = current().rotation;
    }
    $("styleControls").hidden = !hasStyle;
    $("transparencyControl").hidden =
      session.state.entities.some(
        (e) => interaction.selection.has(e.id) && e.type === "pdfMarkup",
      ) ||
      !(
        hasStyle ||
        ["viewport", "block", "mask"].includes(activeType) ||
        interaction.selection.size > 1
      );
    $("transparencyValue").value = `${$("transparency").value} %`;

    $("selectionHint").hidden =
      hasStyle || ["block", "viewport"].includes(current()?.type);
    $("selectionHint").textContent =
      interaction.selection.size > 1
        ? "Högerklick: gruppera · Ctrl/⌘-klick: välj enskilt objekt"
        : activeType === "pdfMarkup"
          ? "Originalmarkering · flytta, kopiera, radera och ändra storlek med hörngrepp. Innehåll och utseende redigeras i Bluebeam."
          : activeType === "coverLine"
            ? "Täckning med vitt · originalet finns kvar"
            : activeType === "eraseText"
              ? "Tar bort den rödmarkerade texten ur PDF-innehållet"
              : activeType === "eraseLine"
                ? "Tar bort fristående raka streck ur PDF-innehållet"
                : activeType === "extract"
                  ? "Hämta en kopia · originalet finns kvar"
                  : activeType === "calibrate"
                    ? "Välj två punkter med känt avstånd"
                    : activeType === "mask"
                      ? "Vit täckning · originalinnehållet finns kvar"
                      : "Välj ett verktyg eller ett objekt i ritningen";
    $("lineControl").querySelector("span").textContent =
      activeType === "freehand" ? "px" : "pt";
    $("width").setAttribute(
      "aria-label",
      activeType === "freehand"
        ? "Pennbredd i px vid 100 % zoom"
        : "Linjebredd i pt",
    );
    $("lineControl").hidden = ["text", "replace", "mask"].includes(activeType);
    $("textControl").hidden = !["text", "replace", "leader", "dim"].includes(
      activeType,
    );
    $("editText").hidden =
      !current() ||
      !["text", "leader", "replace", "stamp"].includes(activeType);
    $("delete").hidden = !interaction.selection.size;
    $("replace").classList.toggle("active", interaction.tool === "replace");
    prompt();
    paint();
    document
      .querySelectorAll("[data-tool]")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          b.dataset.tool ===
            (interaction.tool === "ellipse" ? "circle" : interaction.tool),
        ),
      );
    $("undo").disabled = !session.undoStack.length;
    $("redo").disabled = !session.redoStack.length;
    $("delete").disabled = !interaction.selection.size;
    $("editText").disabled =
      !current() ||
      !["text", "leader", "replace", "stamp"].includes(current().type);
    for (const [id, on, label] of [
      ["polar", interaction.polar, "POLAR · F10"],
      ["otrack", interaction.otrack, "OTRACK · F11"],
    ]) {
      $(id).textContent = `${label} · ${on ? "PÅ" : "AV"}`;
      $(id).classList.toggle("active", on);
      $(id).setAttribute("aria-pressed", String(on));
    }
    $("ortho").textContent = `ORTHO ${interaction.ortho ? "PÅ" : "AV"} · F8`;
    $("ortho").classList.toggle("active", interaction.ortho);
    $("snap").classList.toggle("active", interaction.snap);
    $("snap").textContent = `SNAPP ${interaction.snap ? "PÅ" : "AV"}`;
    const scale = session.state.scales[workspace.pageNo];
    $("scaleLabel").textContent = scale ? "Skala kalibrerad" : "Ej kalibrerad";
    $("calibrate").textContent = scale ? "Ändra skala" : "Kalibrera";
    shell.update({
      pdf: workspace.pdf,
      page: workspace.pageNo,
      selectionCount: interaction.selection.size,
      tool: interaction.tool,
      toolLabel: names[interaction.tool],
    });
  }

  return { refresh };
}
