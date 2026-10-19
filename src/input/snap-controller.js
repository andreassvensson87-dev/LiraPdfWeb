import { polarPoint, trackingPoint } from "../drawing-aids.js";
import { nearestSnap, nearestSegment } from "../pdf-snapping.js";
import { distance, box, constrain } from "../model/geometry.js";
import { primitives } from "../model/entity-primitives.js";

export function createSnapController({
  pageEntities,
  workspace,
  interaction,
  $,
  displayedPage,
  tracker,
  paint,
}) {
  function clearTracking() {
    tracker.clear();
    interaction.trackingAnchors = [];
    interaction.aidGuides = [];
    clearTimeout(interaction.trackTimer);
  }

  function pdfLineAt(point) {
    const covered = pageEntities().some((e) => {
      if (!["mask", "replace"].includes(e.type) || (e.opacity ?? 1) < 1)
        return false;
      const r = box(...e.points);
      return (
        point.x >= r.x &&
        point.x <= r.x + r.w &&
        point.y >= r.y &&
        point.y <= r.y + r.h
      );
    });
    return covered
      ? null
      : nearestSegment(point, workspace.pdfSegments, 8 / workspace.zoom);
  }
  function localPoint(ev, constrained = true) {
    if (["freehand", "highlight"].includes(interaction.tool))
      constrained = false;
    const r = $("viewport").getBoundingClientRect();
    let p = {
      x: (ev.clientX - r.left - workspace.pan.x) / workspace.zoom,
      y: (ev.clientY - r.top - workspace.pan.y) / workspace.zoom,
    };
    p = displayedPage().inverse(p);
    const drawing =
      constrained &&
      interaction.tool !== "select" &&
      ![
        "mask",
        "replace",
        "extract",
        "coverLine",
        "eraseLine",
        "eraseText",
        "viewport",
      ].includes(interaction.tool) &&
      !interaction.space;
    const rawPointer = { ...p };
    interaction.aidGuides = [];
    interaction.snapHit = null;
    if (
      constrained &&
      interaction.snap &&
      !["mask", "replace", "extract", "eraseText"].includes(interaction.tool)
    ) {
      const raw = { ...p };
      let best = 9 / workspace.zoom;
      for (const e of pageEntities().filter(
        (e) =>
          !interaction.drag?.ids?.includes(e.id) &&
          e.id !== interaction.drag?.id &&
          e.id !== interaction.activeGrip?.id &&
          e.type !== "pdfErase",
      ))
        for (const [index, q] of e.points.entries()) {
          const d = distance(raw, q);
          if (d < best) {
            best = d;
            p = { ...q };
            interaction.snapHit = {
              point: p,
              kind:
                e.type === "circle" && index === 0
                  ? "Centrum"
                  : e.type === "line" || e.type === "leader"
                    ? "Ändpunkt"
                    : "Objekt",
            };
          }
        }
      const ownSegments = pageEntities()
        .filter(
          (e) =>
            !interaction.drag?.ids?.includes(e.id) &&
            e.id !== interaction.drag?.id &&
            e.id !== interaction.activeGrip?.id &&
            ["line", "rect", "leader", "polyline"].includes(e.type),
        )
        .flatMap((e) =>
          primitives(e, 1)
            .filter((p) => p.kind === "line")
            .map((p) => ({ a: p.a, b: p.b })),
        );
      const ownHit = nearestSnap(raw, ownSegments, best);
      if (ownHit && (!interaction.snapHit || ownHit.kind !== "Linje")) {
        p = ownHit.point;
        interaction.snapHit = ownHit;
      }
      if (!interaction.snapHit) {
        const hit = nearestSnap(raw, workspace.pdfSegments, 9 / workspace.zoom);
        if (hit) {
          const covered = pageEntities()
            .filter(
              (e) =>
                ["mask", "replace"].includes(e.type) && (e.opacity ?? 1) === 1,
            )
            .some((e) => {
              const r = box(...e.points);
              return (
                hit.point.x >= r.x &&
                hit.point.x <= r.x + r.w &&
                hit.point.y >= r.y &&
                hit.point.y <= r.y + r.h
              );
            });
          if (!covered) {
            p = hit.point;
            interaction.snapHit = hit;
          }
        }
      }
    }
    if (drawing && interaction.otrack && interaction.snap) {
      interaction.trackingAnchors = tracker.update(
        interaction.snapHit,
        performance.now(),
      );
      clearTimeout(interaction.trackTimer);
      if (interaction.snapHit && interaction.snapHit.kind !== "Linje") {
        const heldHit = interaction.snapHit;
        interaction.trackTimer = setTimeout(() => {
          if (
            !interaction.otrack ||
            !interaction.snap ||
            interaction.tool === "select"
          )
            return;
          interaction.trackingAnchors = tracker.update(
            heldHit,
            performance.now(),
          );
          paint();
        }, 470);
      }
    }
    if (drawing && !interaction.snapHit) {
      const origin = interaction.points.at(-1);
      if (
        origin &&
        interaction.ortho &&
        ["line", "leader", "dim", "move", "copy"].includes(interaction.tool)
      )
        p = constrain(origin, rawPointer, true);
      else {
        const polarHit =
          origin &&
          interaction.polar &&
          ["line", "leader", "dim", "circle", "move", "copy"].includes(
            interaction.tool,
          )
            ? polarPoint(origin, rawPointer, interaction.polarAngle)
            : null;
        if (polarHit) {
          const tracked =
            interaction.otrack && interaction.snap
              ? trackingPoint(
                  rawPointer,
                  interaction.trackingAnchors,
                  8 / workspace.zoom,
                  polarHit,
                )
              : null;
          p = tracked ? tracked.point : polarHit.point;
          interaction.aidGuides = [
            {
              a: origin,
              b: {
                x: p.x + (Math.cos(polarHit.angle) * 40) / workspace.zoom,
                y: p.y + (Math.sin(polarHit.angle) * 40) / workspace.zoom,
              },
              polar: true,
            },
            ...(tracked?.guides || []),
          ];
        } else if (interaction.otrack && interaction.snap) {
          const tracked = trackingPoint(
            rawPointer,
            interaction.trackingAnchors,
            8 / workspace.zoom,
          );
          if (tracked) {
            p = tracked.point;
            interaction.aidGuides = tracked.guides;
          }
        }
      }
    }
    return p;
  }

  return { pdfLineAt, localPoint, clearTracking };
}
