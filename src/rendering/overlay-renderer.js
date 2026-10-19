import { counts } from "../editor/tool-catalog.js";
import { textTargetAt } from "../model/text-hit-testing.js";
import { moveGrip } from "../grips.js";
import { snapSymbol } from "../drawing-aids.js";
import { box } from "../model/geometry.js";

export function createOverlayRenderer({
  workspace,
  $,
  interaction,
  drawEntity,
  svg,
  pdfLineAt,
  pageEntities,
  editedEntities,
  style,
  scaleContext,
}) {
  function paint() {
    if (!workspace.viewport) return;
    $("overlay").replaceChildren();
    if (interaction.drag?.kind === "freehand")
      drawEntity(interaction.drag.entity, true);
    if (interaction.tool === "eraseText" && interaction.hover) {
      const hit = textTargetAt(
        workspace.removableTextTargets,
        interaction.hover,
      );
      if (hit)
        svg("polygon", {
          points: hit.polygon.map((p) => `${p.x},${p.y}`).join(" "),
          fill: "#d5444426",
          stroke: "#d54444",
          "stroke-width": 1 / workspace.zoom,
          "pointer-events": "none",
        });
    }
    if (
      ["extract", "coverLine", "eraseLine"].includes(interaction.tool) &&
      interaction.hover
    ) {
      const segment = pdfLineAt(interaction.hover);
      if (segment)
        svg("line", {
          x1: segment.a.x,
          y1: segment.a.y,
          x2: segment.b.x,
          y2: segment.b.y,
          stroke: "#e4a22d",
          "stroke-width": 4 / workspace.zoom,
          "pointer-events": "none",
        });
    }

    for (const e of pageEntities()
      .filter((e) => e.type !== "pdfErase")
      .sort((a, b) => (a.type !== "viewport") - (b.type !== "viewport")))
      try {
        drawEntity(
          interaction.activeGrip?.id === e.id && interaction.hover
            ? moveGrip(e, interaction.activeGrip.index, interaction.hover)
            : e,
        );
      } catch {}
    if (
      interaction.editOperation &&
      interaction.hover &&
      ["target", "side"].includes(interaction.editOperation.phase)
    ) {
      try {
        for (const e of editedEntities(interaction.hover)) drawEntity(e, true);
      } catch {}
    }
    if (
      interaction.tool === "block" &&
      interaction.pendingBlock &&
      interaction.hover
    )
      drawEntity(
        { ...interaction.pendingBlock, points: [interaction.hover] },
        true,
      );
    if (interaction.points.length && interaction.hover) {
      const ps = [...interaction.points, interaction.hover];
      if (interaction.tool === "calibrate")
        drawEntity({ type: "line", points: ps, ...style() }, true);
      else if (
        ps.length === counts[interaction.tool] &&
        interaction.tool !== "text"
      )
        try {
          drawEntity(
            {
              type: interaction.tool,
              page: workspace.pageNo,
              viewportId: scaleContext(ps[0]).owner?.id,
              points: ps,
              text:
                interaction.tool === "leader"
                  ? "Kommentar"
                  : interaction.tool === "stamp"
                    ? $("stampPreset").value === "custom"
                      ? "Egen text"
                      : $("stampPreset").value
                    : "",
              ...style(),
              ...(interaction.tool === "mask" ? { color: "#ffffff" } : {}),
            },
            true,
          );
        } catch {}
      else
        svg("polyline", {
          points: ps.map((p) => `${p.x},${p.y}`).join(" "),
          fill: "none",
          stroke: "#147b60",
          "stroke-width": 1 / workspace.zoom,
          "stroke-dasharray": `${4 / workspace.zoom} ${4 / workspace.zoom}`,
        });
    }
    if (interaction.tool !== "select") {
      for (const guide of interaction.aidGuides)
        svg("line", {
          x1: guide.a.x,
          y1: guide.a.y,
          x2: guide.b.x,
          y2: guide.b.y,
          stroke: guide.polar ? "#398b61" : "#5592a4",
          "stroke-width": 1 / workspace.zoom,
          "stroke-dasharray": `${6 / workspace.zoom} ${4 / workspace.zoom}`,
          "pointer-events": "none",
        });
      if (interaction.otrack)
        for (const p of interaction.trackingAnchors)
          svg("path", {
            d: `M ${p.x - 3 / workspace.zoom} ${p.y} h ${6 / workspace.zoom} M ${p.x} ${p.y - 3 / workspace.zoom} v ${6 / workspace.zoom}`,
            stroke: "#5592a4",
            "stroke-width": 1 / workspace.zoom,
            "pointer-events": "none",
          });
    }
    if (
      interaction.snapHit &&
      interaction.hover &&
      interaction.tool !== "select"
    ) {
      const p = interaction.snapHit.point,
        r = 4 / workspace.zoom,
        attrs = {
          fill: "white",
          stroke: "#c48b24",
          "stroke-width": 1.5 / workspace.zoom,
          "pointer-events": "none",
        };
      if (interaction.snapHit.kind === "Centrum")
        svg("circle", { cx: p.x, cy: p.y, r, ...attrs });
      else
        svg("path", {
          d: snapSymbol(interaction.snapHit.kind, p.x, p.y, r),
          ...attrs,
        });
    }
    if (interaction.hover && interaction.tool !== "select") {
      svg("path", {
        d: `M ${interaction.hover.x - 6 / workspace.zoom} ${interaction.hover.y} h ${12 / workspace.zoom} M ${interaction.hover.x} ${interaction.hover.y - 6 / workspace.zoom} v ${12 / workspace.zoom}`,
        stroke: "#167d60",
        "stroke-width": 1 / workspace.zoom,
        "pointer-events": "none",
      });
    }
    if (interaction.drag?.kind === "selection") {
      const r = box(interaction.drag.start, interaction.drag.end),
        crossing = interaction.drag.end.x < interaction.drag.start.x;
      svg("rect", {
        x: r.x,
        y: r.y,
        width: r.w,
        height: r.h,
        fill: crossing ? "#36a777" : "#408cdc",
        "fill-opacity": 0.12,
        stroke: crossing ? "#218654" : "#2879c4",
        "stroke-width": 1 / workspace.zoom,
        "stroke-dasharray": crossing
          ? `${5 / workspace.zoom} ${3 / workspace.zoom}`
          : "none",
        "pointer-events": "none",
        "data-selection-window": crossing ? "crossing" : "window",
      });
    }
  }

  return { paint };
}
