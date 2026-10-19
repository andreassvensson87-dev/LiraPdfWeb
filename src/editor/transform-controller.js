import { copyGroupIds } from "../groups.js";
import { referenceValue } from "../command-input.js";
import {
  transformEntity,
  joinEntities,
  explodeEntity,
  vertexEdit,
  trimLine,
  cornerLines,
} from "../advanced-editing.js";
import { translateEntity, offsetEntity } from "../editing.js";
import { entityScale } from "../viewports.js";
import { distance, constrain } from "../model/geometry.js";

export function createTransformController({
  interaction,
  session,
  clone,
  commit,
  setTool,
  refresh,
  clearTracking,
  toast,
  error,
  pageEntities,
  editTypes,
  editPhase,
}) {
  function finishSelection() {
    const es = interaction.editOperation.ids.map((id) =>
      session.state.entities.find((e) => e.id === id),
    );
    if (!es.length) throw Error("Välj minst ett objekt först.");
    const next = clone(session.state);
    const ids = new Set(interaction.editOperation.ids);
    next.entities = next.entities.filter(
      (e) =>
        !ids.has(e.id) &&
        !(interaction.tool === "erase" && ids.has(e.viewportId)),
    );
    if (interaction.tool === "join") next.entities.push(joinEntities(es));
    if (interaction.tool === "explode")
      for (const e of es)
        next.entities.push(
          ...explodeEntity(e).map((n) => ({ ...n, id: crypto.randomUUID() })),
        );
    commit(next);
    setTool("select");
  }
  function advancedPick(p, id) {
    const e = session.state.entities.find((e) => e.id === id),
      next = clone(session.state);
    if (interaction.editOperation.phase === "cut") {
      if (!e) throw Error("Klicka på en ritad linje.");
      const result = trimLine(
        e,
        session.state.entities.filter((x) =>
          interaction.editOperation.ids.includes(x.id),
        ),
        p,
        interaction.tool === "extend",
      );
      next.entities = next.entities.filter((x) => x.id !== id);
      const replacements = result.map((x, i) => ({
        ...x,
        id: i ? crypto.randomUUID() : id,
      }));
      next.entities.push(...replacements);
      if (interaction.editOperation.ids.includes(id))
        interaction.editOperation.ids = [
          ...interaction.editOperation.ids.filter((x) => x !== id),
          ...replacements.map((x) => x.id),
        ];
    } else if (interaction.editOperation.phase === "vertex") {
      const source = session.state.entities.find(
        (e) => e.id === interaction.editOperation.ids[0],
      );
      const n = vertexEdit(source, p, interaction.tool === "pdelete");
      next.entities[next.entities.findIndex((e) => e.id === source.id)] = n;
    } else {
      if (!e || e.type !== "line") throw Error("Välj en rak linje.");
      if (!interaction.editOperation.first) {
        interaction.editOperation.first = { id, p };
        refresh();
        return;
      }
      const first = session.state.entities.find(
        (x) => x.id === interaction.editOperation.first.id,
      );
      if (first.viewportId !== e.viewportId)
        throw Error("Linjerna måste tillhöra samma viewport eller papper.");
      const scale = entityScale(
        e,
        session.state.entities,
        session.state.scales,
      );
      if (!scale)
        throw Error("Kalibrera pappret eller använd en viewport först.");
      const result = cornerLines(
        first,
        e,
        interaction.editOperation.first.p,
        p,
        interaction.editOperation.amount / scale,
        interaction.tool === "fillet",
      );
      for (const n of result.updated)
        next.entities[next.entities.findIndex((x) => x.id === n.id)] = n;
      if (result.bridge)
        next.entities.push({ ...result.bridge, id: crypto.randomUUID() });
      interaction.editOperation.first = null;
    }
    commit(next);
    clearTracking();
    refresh();
  }
  function editedEntities(p) {
    return interaction.editOperation.ids.map((id) => {
      const e = session.state.entities.find((e) => e.id === id);
      if (interaction.tool === "offset") {
        const scale = entityScale(
          e,
          session.state.entities,
          session.state.scales,
        );
        if (!scale)
          throw Error("Kalibrera pappret eller använd en viewport först.");
        return offsetEntity(e, interaction.editOperation.amount / scale, p);
      }
      if (["rotate", "scale", "mirror"].includes(interaction.tool))
        return transformEntity(
          e,
          interaction.tool,
          interaction.points[0],
          p,
          interaction.editOperation.value,
        );
      return translateEntity(e, interaction.points[0], p);
    });
  }
  function operationScale() {
    const scales = interaction.editOperation.ids.map((id) =>
      entityScale(
        session.state.entities.find((e) => e.id === id),
        session.state.entities,
        session.state.scales,
      ),
    );
    if (!scales[0] || scales.some((s) => s !== scales[0]))
      throw Error("Exakt längd kräver objekt med samma kalibrerade skala.");
    return scales[0];
  }
  function editPoint(p) {
    if (interaction.editOperation.phase === "refOld") {
      interaction.editOperation.refPoint = p;
      interaction.editOperation.phase = "refPick2";
      refresh();
      return;
    }
    if (interaction.editOperation.phase === "refPick2") {
      if (distance(interaction.editOperation.refPoint, p) < 1e-8) {
        toast("Välj två olika referenspunkter.");
        return;
      }
      interaction.editOperation.reference =
        interaction.tool === "rotate"
          ? Math.atan2(
              p.y - interaction.editOperation.refPoint.y,
              p.x - interaction.editOperation.refPoint.x,
            )
          : distance(interaction.editOperation.refPoint, p);
      interaction.editOperation.phase = "refTarget";
      refresh();
      return;
    }
    if (interaction.editOperation.phase === "refTarget") {
      try {
        interaction.editOperation.value = referenceValue(
          interaction.tool,
          interaction.editOperation.reference,
          interaction.tool === "rotate"
            ? Math.atan2(
                p.y - interaction.points[0].y,
                p.x - interaction.points[0].x,
              )
            : distance(interaction.points[0], p),
        );
        interaction.editOperation.phase = "target";
      } catch (e) {
        error(e);
        return;
      }
    }
    if (interaction.editOperation.phase === "base") {
      interaction.points = [p];
      interaction.editOperation.phase = "target";
      refresh();
      return;
    }
    if (!["target", "side"].includes(interaction.editOperation.phase)) return;
    if (
      interaction.tool === "scale" &&
      interaction.editOperation.value === undefined
    ) {
      toast("Skriv en skalfaktor i kommandoraden.");
      return;
    }
    try {
      const edits = editedEntities(p),
        next = clone(session.state);
      const copies = copyGroupIds(edits, () => crypto.randomUUID());
      for (const [index, e] of edits.entries()) {
        if (["move", "rotate", "scale"].includes(interaction.tool))
          next.entities[next.entities.findIndex((x) => x.id === e.id)] = e;
        else next.entities.push(copies[index]);
      }
      commit(next);
      if (["move", "rotate", "scale", "mirror"].includes(interaction.tool))
        setTool("select");
      else {
        clearTracking();
        interaction.hover = null;
        refresh();
      }
    } catch (e) {
      error(e);
    }
  }
  function editCommand(value, number) {
    if (
      value.toUpperCase() === "R" &&
      ["rotate", "scale"].includes(interaction.tool) &&
      interaction.editOperation.phase === "target"
    ) {
      interaction.editOperation.phase = "refOld";
      delete interaction.editOperation.value;
      refresh();
      return;
    }
    if (
      ["refOld", "refTarget"].includes(interaction.editOperation.phase) &&
      value &&
      Number.isFinite(number)
    ) {
      try {
        const n =
          interaction.tool === "rotate"
            ? (-number * Math.PI) / 180
            : number / operationScale();
        if (interaction.tool === "scale" && n <= 0)
          throw Error("Längden måste vara positiv.");
        if (interaction.editOperation.phase === "refOld") {
          interaction.editOperation.reference = n;
          interaction.editOperation.phase = "refTarget";
        } else {
          interaction.editOperation.value = referenceValue(
            interaction.tool,
            interaction.editOperation.reference,
            n,
          );
          interaction.editOperation.phase = "target";
          editPoint(interaction.hover || interaction.points[0]);
        }
      } catch (e) {
        error(e);
      }
      refresh();
      return;
    }
    if (interaction.editOperation.phase === "select") {
      if (["erase", "join", "explode"].includes(interaction.tool)) {
        try {
          finishSelection();
        } catch (e) {
          error(e);
        }
        return;
      }
      if (
        !interaction.editOperation.ids.length &&
        ["trim", "extend"].includes(interaction.tool)
      )
        interaction.editOperation.ids = pageEntities()
          .filter((e) => editTypes(interaction.tool).includes(e.type))
          .map((e) => e.id);
      if (!interaction.editOperation.ids.length) {
        toast("Välj minst ett objekt först.");
        return;
      }
      interaction.editOperation.phase = editPhase(interaction.tool);
    } else if (interaction.editOperation.phase === "distance") {
      if (
        (["fillet", "chamfer"].includes(interaction.tool)
          ? number < 0 || !value
          : !(number > 0)) ||
        !Number.isFinite(number)
      ) {
        toast("Ange ett positivt avstånd i mm.");
        return;
      }
      if (
        interaction.editOperation.ids.some(
          (id) =>
            !entityScale(
              session.state.entities.find((e) => e.id === id),
              session.state.entities,
              session.state.scales,
            ),
        )
      ) {
        toast("Kalibrera pappret eller använd en viewport först.");
        return;
      }
      interaction.editOperation.amount = number;
      interaction.editOperation.phase = ["fillet", "chamfer"].includes(
        interaction.tool,
      )
        ? "corner"
        : "side";
    } else if (
      interaction.editOperation.phase === "target" &&
      ["rotate", "scale"].includes(interaction.tool) &&
      value &&
      Number.isFinite(number)
    ) {
      if (interaction.tool === "scale" && number <= 0) {
        toast("Ange en positiv skalfaktor.");
        return;
      }
      interaction.editOperation.value =
        interaction.tool === "rotate" ? (-number * Math.PI) / 180 : number;
      editPoint(interaction.hover || interaction.points[0]);
    } else if (
      interaction.editOperation.phase === "target" &&
      number > 0 &&
      interaction.hover &&
      ["move", "copy"].includes(interaction.tool)
    ) {
      const scales = interaction.editOperation.ids.map((id) =>
        entityScale(
          session.state.entities.find((e) => e.id === id),
          session.state.entities,
          session.state.scales,
        ),
      );
      if (!scales[0] || scales.some((s) => s !== scales[0])) {
        toast("Exakt avstånd kräver objekt med samma kalibrerade skala.");
        return;
      }
      editPoint(
        constrain(
          interaction.points[0],
          interaction.hover,
          false,
          number,
          scales[0],
        ),
      );
    } else if (!value) setTool("select");
    else toast("Ange en punkt i ritningen eller ett giltigt avstånd.");
    refresh();
  }

  return {
    advancedPick,
    editedEntities,
    operationScale,
    editPoint,
    editCommand,
  };
}
