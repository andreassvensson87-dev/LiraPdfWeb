import { aliases } from "./tool-catalog.js";
import { moveGrip, gripLengthPoint } from "../grips.js";
import { exactPoint } from "../command-input.js";
import { entityScale } from "../viewports.js";
import { box, constrain } from "../model/geometry.js";

export function createCommandController({
  clone,
  session,
  interaction,
  commit,
  refresh,
  workspace,
  error,
  setTool,
  scaleContext,
  operationScale,
  editPoint,
  addPoint,
  editCommand,
  toast,
  library,
  history,
  fit,
  fitAll,
  canRun,
  recordCommand,
}) {
  function applyGrip(p) {
    const next = clone(session.state),
      index = next.entities.findIndex(
        (e) => e.id === interaction.activeGrip.id,
      );
    if (index < 0) {
      interaction.activeGrip = null;
      return;
    }
    next.entities[index] = moveGrip(
      next.entities[index],
      interaction.activeGrip.index,
      p,
    );
    interaction.activeGrip = null;
    interaction.hover = null;
    commit(next);
    refresh();
  }
  function runCommand(value) {
    if (!canRun()) return;
    value = value.trim();
    if (value) recordCommand(value);
    const number = Number(value.replace(",", "."));
    if (interaction.activeGrip) {
      if (!value) {
        interaction.activeGrip = null;
        interaction.hover = null;
        refresh();
        return;
      }
      try {
        const e = session.state.entities.find(
          (e) => e.id === interaction.activeGrip.id,
        );
        const scale = entityScale(
          e,
          session.state.entities,
          session.state.scales,
        );
        const owner = session.state.entities.find((v) => v.id === e.viewportId);
        const r = owner
          ? box(...owner.points)
          : { x: 0, y: 0, h: workspace.viewport.height };
        const p = Number.isFinite(number)
          ? gripLengthPoint(
              e,
              interaction.activeGrip.index,
              number,
              scale,
              interaction.hover,
            )
          : exactPoint(value, {
              base: e.points[interaction.activeGrip.index],
              origin: { x: r.x, y: r.y + r.h },
              scale,
            });
        if (!p) throw Error("Ange ett mått eller en koordinat för greppet.");
        applyGrip(p);
      } catch (e) {
        error(e);
      }
      return;
    }
    if (!value && !interaction.editOperation) {
      if (interaction.tool !== "select") setTool("select");
      else if (interaction.lastTool) setTool(interaction.lastTool);
      return;
    }
    const canPoint = interaction.editOperation
      ? (["base", "target", "refOld", "refPick2", "refTarget"].includes(
          interaction.editOperation.phase,
        ) &&
          !["scale", "rotate"].includes(interaction.tool)) ||
        ["base", "refOld", "refPick2"].includes(interaction.editOperation.phase)
      : [
          "line",
          "circle",
          "rect",
          "arc",
          "leader",
          "dim",
          "viewport",
          "text",
          "calibrate",
        ].includes(interaction.tool);
    if (
      canPoint &&
      (/^[@#]/.test(value) ||
        value.includes("<") ||
        value.includes(";") ||
        (!Number.isFinite(number) && value.includes(",")))
    ) {
      try {
        const base = interaction.points.at(-1),
          context = scaleContext(base || interaction.hover),
          r = context.owner
            ? box(...context.owner.points)
            : { x: 0, y: 0, h: workspace.viewport.height };
        const scale =
          interaction.editOperation && base ? operationScale() : context.scale;
        const p = exactPoint(value, {
          base,
          origin: { x: r.x, y: r.y + r.h },
          scale,
        });
        if (p) {
          if (interaction.editOperation) editPoint(p);
          else addPoint(p);
          return;
        }
      } catch (e) {
        error(e);
        return;
      }
    }
    if (
      interaction.editOperation &&
      (value === "" || Number.isFinite(number) || value.toUpperCase() === "R")
    )
      editCommand(value, number);
    else if (["HJÄLP", "HELP", "?"].includes(value.toUpperCase()))
      toast(
        "M: flytta · CO: kopiera · O: offset · RO: rotera · SC: skala · MI: spegla · TR: trimma · EX: förläng · E: radera · J: sammanfoga · X: dela upp · F: avrunda · CHA: fasa · PI/PD: hörn · L: linje · C: cirkel · REC: rektangel · A: båge · T: text · LE: leader · BLOCK: blockbibliotek · DIM: mått · CAL: kalibrera · VP: viewport · MASK: maska · TEXTEDIT: ersätt text · GETLINE: kopiera PDF-linje · COVERLINE: täck linje · ERASELINE: ta bort PDF-linje · ERASETEXT: ta bort PDF-text · U: ångra · Z: anpassa · ZE: visa allt · Esc: avbryt",
      );
    else if (value.toUpperCase() === "BLOCK") library.open();
    else if (aliases[value.toUpperCase()])
      setTool(aliases[value.toUpperCase()]);
    else if (value.toUpperCase() === "U") history();
    else if (value.toUpperCase() === "Z") fit();
    else if (value.toUpperCase() === "ZE") fitAll();
    else if (
      number > 0 &&
      interaction.points.length &&
      interaction.hover &&
      ["line", "circle"].includes(interaction.tool)
    ) {
      const activeScale = scaleContext(interaction.points[0]).scale;
      if (!activeScale)
        toast(
          "Kalibrera pappret eller börja i en viewport för att ange längder i mm.",
        );
      else
        addPoint(
          constrain(
            interaction.points[0],
            interaction.hover,
            false,
            number,
            activeScale,
          ),
        );
    } else toast("Okänt kommando. Skriv HJÄLP för att se alla kommandon.");
  }
  return { applyGrip, runCommand };
}
