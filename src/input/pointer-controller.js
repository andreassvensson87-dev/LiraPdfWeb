import { previewEntityDrag } from "../model/drag-geometry.js";
import { expandGroups } from "../groups.js";
import { appendStrokePoint, completeStroke } from "../freehand.js";

import { inSelection, mergeSelection } from "../selection.js";

import { entityScale } from "../viewports.js";

import { distance, box } from "../model/geometry.js";
import { primitives } from "../model/entity-primitives.js";

export function createPointerController({
  $,
  workspace,
  interaction,
  documentScroll,
  showPage,
  localPoint,
  style,
  scaleContext,
  paint,
  applyGrip,
  error,
  clone,
  session,
  commit,
  select,
  toast,
  editTypes,
  refresh,
  advancedPick,
  editPoint,
  addPoint,
  tracker,
  view,
  current,
  prompt,
  pageEntities,
  document,
  contentActions,
}) {
  $("viewport").addEventListener("pointerdown", async (ev) => {
    if (ev.target.closest(".page-navigation")) return;
    if (!workspace.viewport || interaction.pendingDialog || workspace.busy)
      return;
    if (interaction.drag?.kind === "freehand") return;
    if (ev.button === 1 || interaction.space) {
      if (interaction.space) interaction.spacePanned = true;
      ev.preventDefault();
      interaction.drag = {
        kind: "pan",
        start: { x: ev.clientX, y: ev.clientY },
        pan: { ...workspace.pan },
      };
      $("viewport").setPointerCapture(ev.pointerId);
      return;
    }
    if (ev.button !== 0) return;
    const neighbouringPage = ev.target.closest(".document-page-preview");
    if (neighbouringPage) {
      const layout = documentScroll.getLayout();
      const target = layout[Number(neighbouringPage.dataset.page) - 1];
      const anchor = layout[workspace.pageNo - 1];
      if (target && anchor)
        await showPage(target.page, true, {
          x:
            workspace.pan.x +
            ((anchor.width - target.width) * workspace.zoom) / 2,
          y: workspace.pan.y + (target.top - anchor.top) * workspace.zoom,
        });
      return;
    }
    const p = localPoint(ev);
    if (["freehand", "highlight"].includes(interaction.tool)) {
      ev.preventDefault();
      interaction.drag = {
        kind: "freehand",
        pointerId: ev.pointerId,
        entity: {
          id: crypto.randomUUID(),
          type: interaction.tool,
          page: workspace.pageNo,
          points: [p],
          ...style(),
          viewportId: scaleContext(p).owner?.id,
        },
      };
      $("viewport").setPointerCapture(ev.pointerId);
      paint();
      return;
    }
    if (interaction.activeGrip) {
      try {
        applyGrip(p);
      } catch (e) {
        error(e);
      }
      return;
    }

    if (
      ["block", "eraseText", "coverLine", "eraseLine", "extract"].includes(
        interaction.tool,
      )
    ) {
      await contentActions.pick(p);
      return;
    }
    if (
      (interaction.tool === "select" ||
        interaction.editOperation?.phase === "select") &&
      !ev.target.closest("[data-id]")
    ) {
      interaction.drag = {
        kind: "selection",
        start: localPoint(ev, false),
        end: localPoint(ev, false),
        before: [...(interaction.editOperation?.ids || interaction.selection)],
        edit: !!interaction.editOperation,
        individual: ev.ctrlKey || ev.metaKey,
        mode: ev.altKey
          ? "remove"
          : ev.shiftKey || interaction.editOperation
            ? "add"
            : "replace",
      };
      $("viewport").setPointerCapture(ev.pointerId);
      paint();
      return;
    }
    if (interaction.editOperation) {
      if (interaction.editOperation.phase === "select") {
        const id = ev.target.closest("[data-id]")?.dataset.id;
        const e = session.state.entities.find((e) => e.id === id);
        if (!e || !editTypes(interaction.tool).includes(e.type)) {
          toast(
            interaction.tool === "offset"
              ? "Välj en ritad linje, cirkel eller rektangel."
              : "Välj ett ritat objekt. Använd Hämta linje för PDF-underlaget.",
          );
          return;
        }
        const members = (
          ev.ctrlKey ||
          ev.metaKey ||
          ["pinsert", "pdelete"].includes(interaction.tool)
            ? [id]
            : expandGroups(session.state.entities, [id])
        ).filter((id) =>
          editTypes(interaction.tool).includes(
            session.state.entities.find((e) => e.id === id)?.type,
          ),
        );
        const i = interaction.editOperation.ids.indexOf(id);
        if (i < 0) {
          if (["pinsert", "pdelete"].includes(interaction.tool))
            interaction.editOperation.ids = [];
          interaction.editOperation.ids.push(
            ...members.filter(
              (id) => !interaction.editOperation.ids.includes(id),
            ),
          );
        } else
          interaction.editOperation.ids = interaction.editOperation.ids.filter(
            (id) => !members.includes(id),
          );
        refresh();
      } else if (
        ["cut", "corner", "vertex"].includes(interaction.editOperation.phase)
      ) {
        try {
          advancedPick(p, ev.target.closest("[data-id]")?.dataset.id);
        } catch (e) {
          error(e);
        }
      } else editPoint(p);
      return;
    }
    if (interaction.tool === "select") {
      const id = ev.target.closest("[data-id]")?.dataset.id;
      if (id) {
        if (ev.ctrlKey || ev.metaKey) select(id, true);
        else if (ev.shiftKey || ev.altKey) {
          const members = expandGroups(session.state.entities, [id]);
          const remove =
            ev.altKey || members.every((id) => interaction.selection.has(id));
          for (const member of members)
            remove
              ? interaction.selection.delete(member)
              : interaction.selection.add(member);
          interaction.selected =
            interaction.selection.size === 1
              ? [...interaction.selection][0]
              : null;
          if (interaction.selected) select(interaction.selected, true);
          refresh();
          return;
        } else if (
          !interaction.selection.has(id) ||
          !expandGroups(session.state.entities, [id]).every((id) =>
            interaction.selection.has(id),
          )
        )
          select(id);
        interaction.drag = {
          kind: "entity",
          ids: [...interaction.selection],
          start: p,
          before: clone(session.state),
          id,
          grip:
            interaction.selection.size === 1 &&
            ev.target.hasAttribute("data-grip")
              ? Number(ev.target.getAttribute("data-grip"))
              : null,
          moved: false,
        };
        $("viewport").setPointerCapture(ev.pointerId);
      } else select(null);
    } else if (["replace", "mask"].includes(interaction.tool)) {
      interaction.points = [p];
      interaction.drag = { kind: "area" };
      $("viewport").setPointerCapture(ev.pointerId);
    } else addPoint(p);
  });
  $("viewport").addEventListener("pointerleave", () => {
    clearTimeout(interaction.trackTimer);
    if (interaction.otrack)
      interaction.trackingAnchors = tracker.update(null, performance.now());
  });
  $("viewport").addEventListener("pointermove", (ev) => {
    if (!workspace.viewport) return;
    const p = localPoint(ev, interaction.drag?.kind !== "selection");
    if (interaction.drag?.kind === "freehand") {
      if (ev.pointerId !== interaction.drag.pointerId) return;
      // Some browsers deliver a released move before pointerup, or lose capture.
      if (ev.buttons === 0) {
        finishDrag(ev);
        return;
      }
      const samples = ev.getCoalescedEvents?.();
      for (const event of samples?.length ? samples : [ev])
        appendStrokePoint(
          interaction.drag.entity.points,
          localPoint(event, false),
          0.5 / workspace.zoom,
        );
      paint();
      return;
    }
    if (interaction.drag?.kind === "selection") {
      interaction.drag.end = p;
      paint();
      return;
    }
    if (interaction.drag?.kind === "pan") {
      workspace.pan = {
        x: interaction.drag.pan.x + ev.clientX - interaction.drag.start.x,
        y: interaction.drag.pan.y + ev.clientY - interaction.drag.start.y,
      };
      view();
      return;
    }
    if (interaction.drag?.kind === "entity") {
      if (distance(p, interaction.drag.start) > 2 / workspace.zoom)
        interaction.drag.moved = true;
      try {
        interaction.drag.preview = previewEntityDrag(
          interaction.drag.before,
          interaction.drag,
          p,
        );
      } catch {
        interaction.drag.preview = clone(interaction.drag.before);
      }
      paint();
      return;
    }
    interaction.hover = p;
    prompt();
    paint();
  });
  function finishDrag(ev, cancel = false, useFinalPoint = true) {
    if (!interaction.drag) return;
    if (
      interaction.drag.kind === "freehand" &&
      ev.pointerId !== interaction.drag.pointerId
    )
      return;
    const d = interaction.drag;
    interaction.drag = null;
    if (d.kind === "freehand") {
      if (!cancel) {
        if (
          completeStroke(
            d.entity.points,
            useFinalPoint ? localPoint(ev, false) : null,
          )
        ) {
          const next = clone(session.state);
          next.entities.push(d.entity);
          commit(next);
        }
      }
      if ($("viewport").hasPointerCapture(ev.pointerId))
        $("viewport").releasePointerCapture(ev.pointerId);
      paint();
      return;
    }
    if (d.kind === "selection") {
      if (!cancel) {
        const end = localPoint(ev, false);
        const hits =
          distance(d.start, end) > 3 / workspace.zoom
            ? pageEntities()
                .filter((e) => {
                  const group = [
                    ...$("overlay").querySelectorAll("g.entity"),
                  ].find((g) => g.dataset.id === e.id);
                  const texts = group
                    ? [...group.querySelectorAll("text")].map((t) => {
                        const b = t.getBBox();
                        return { x: b.x, y: b.y, w: b.width, h: b.height };
                      })
                    : [];
                  return inSelection(
                    e,
                    d.start,
                    end,
                    entityScale(
                      e,
                      session.state.entities,
                      session.state.scales,
                    ) || 1,
                    texts,
                  );
                })
                .map((e) => e.id)
            : [];
        let ids = mergeSelection(
          d.before,
          d.individual ? hits : expandGroups(session.state.entities, hits),
          d.mode,
        );
        if (d.edit) {
          ids = ids.filter((id) =>
            editTypes(interaction.tool).includes(
              session.state.entities.find((e) => e.id === id)?.type,
            ),
          );
          if (["pinsert", "pdelete"].includes(interaction.tool))
            ids = ids.slice(-1);
          interaction.editOperation.ids = ids;
        } else {
          interaction.selection.clear();
          ids.forEach((id) => interaction.selection.add(id));
          interaction.selected = ids.length === 1 ? ids[0] : null;
          if (interaction.selected) select(interaction.selected, true);
        }
      }
      refresh();
    }
    if (d.kind === "area") {
      if (cancel) {
        interaction.points = [];
        paint();
      } else addPoint(localPoint(ev));
    }
    if (d.kind === "entity") {
      const next = clone(d.preview || d.before);
      if (!cancel && d.moved) {
        try {
          const e = next.entities.find((e) => e.id === d.id);
          if (
            e.type === "viewport" &&
            (box(...e.points).w < 1 || box(...e.points).h < 1)
          )
            throw Error("Viewporten måste ha bredd och höjd.");
          primitives(e, entityScale(e, next.entities, next.scales) || 1);
          commit(next);
        } catch (e) {
          error(e);
          refresh();
        }
      } else {
        if (
          !cancel &&
          d.grip !== null &&
          ["line", "circle", "arc"].includes(current()?.type)
        )
          interaction.activeGrip = { id: d.id, index: d.grip };
        interaction.hover = null;
        refresh();
      }
    }
    if ($("viewport").hasPointerCapture(ev.pointerId))
      $("viewport").releasePointerCapture(ev.pointerId);
  }
  $("viewport").addEventListener("pointerup", (ev) => finishDrag(ev));
  // Also catch release outside the drawing area if native capture was interrupted.
  document.addEventListener(
    "pointerup",
    (ev) => {
      if (interaction.drag?.kind === "freehand") finishDrag(ev);
    },
    true,
  );
  $("viewport").addEventListener("pointercancel", (ev) => finishDrag(ev, true));
  $("viewport").addEventListener("lostpointercapture", (ev) => {
    if (interaction.drag?.kind === "freehand") finishDrag(ev, false, false);
  });
}
