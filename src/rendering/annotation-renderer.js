import { viewportCaption, entityScale } from "../viewports.js";
import { blockCorners } from "../model/block-geometry.js";
import { box } from "../model/geometry.js";
import { primitives } from "../model/entity-primitives.js";
import { cloudPoints, stampLayout } from "../markup-tools.js";
import { markupPreviewPdf, loadMarkupSource } from "../pdf-markup.js";
import { loadPdf } from "../pdf/viewer.js";

export function createAnnotationRenderer({
  $,
  document,
  NS,
  workspace,
  session,
  interaction,
  displayState,
}) {
  function svg(tag, attrs, parent = $("overlay")) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    parent.append(n);
    return n;
  }
  const markupPreviews = new Map();
  const markupPreviewKey = (entity, documentId = workspace.activeId) =>
    `${documentId}:${entity.pdfAnnotationId || entity.id}`;
  async function prepareMarkupPreviews() {
    const documentId = workspace.activeId,
      sourceBytes = workspace.bytes;
    const pending = session.state.entities.filter(
      (e) =>
        e.type === "pdfMarkup" &&
        !markupPreviews.has(markupPreviewKey(e, documentId)),
    );
    if (!pending.length) return;
    const source = await loadMarkupSource(sourceBytes);
    for (const entity of pending) {
      if (documentId !== workspace.activeId || sourceBytes !== workspace.bytes)
        return;
      const key = markupPreviewKey(entity, documentId);
      if (markupPreviews.has(key)) continue;
      const instance = await loadPdf(await markupPreviewPdf(source, entity));
      try {
        const page = await instance.getPage(1),
          base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, 2048 / Math.max(base.width, base.height)),
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          background: "rgba(0,0,0,0)",
        }).promise;
        markupPreviews.set(key, canvas.toDataURL("image/png"));
      } finally {
        await instance.destroy();
      }
    }
  }
  function drawEntity(e, preview = false, parent = $("overlay")) {
    if (e.id && e.id === interaction.inlineTextId) return;
    const g = svg(
      "g",
      {
        "data-id": e.id || "",
        class: "entity",
        opacity: (e.opacity ?? 1) * (preview ? 0.55 : 1),
      },
      parent,
    );
    const isSelected =
      parent === $("overlay") &&
      !preview &&
      (interaction.selection.has(e.id) ||
        interaction.editOperation?.ids.includes(e.id));
    if (e.type === "pdfMarkup") {
      const rect = box(...e.points),
        image = markupPreviews.get(markupPreviewKey(e));
      g.style.mixBlendMode = e.blendMode || "normal";
      if (image)
        svg(
          "image",
          {
            href: image,
            x: rect.x,
            y: rect.y,
            width: rect.w,
            height: rect.h,
            preserveAspectRatio: "none",
            "pointer-events": "none",
          },
          g,
        );
      svg(
        "rect",
        {
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          fill: "transparent",
          stroke: isSelected ? "#147b60" : "none",
          "stroke-width": 1 / workspace.zoom,
          "pointer-events": "all",
        },
        g,
      );
      if (isSelected)
        e.points.forEach((p, i) =>
          svg(
            "rect",
            {
              x: p.x - 3.5 / workspace.zoom,
              y: p.y - 3.5 / workspace.zoom,
              width: 7 / workspace.zoom,
              height: 7 / workspace.zoom,
              fill: "#fff",
              stroke: "#147b60",
              "stroke-width": 1 / workspace.zoom,
              "data-grip": i,
              "data-id": e.id,
            },
            g,
          ),
        );
      return;
    }
    if (["cloud", "stamp"].includes(e.type)) {
      const r = box(...e.points),
        color = isSelected ? "#2879c4" : e.color;
      if (e.type === "cloud") {
        const pts = cloudPoints(e.points)
          .map((p) => `${p.x},${p.y}`)
          .join(" ");
        svg(
          "polyline",
          {
            points: pts,
            fill: "none",
            stroke: color,
            "stroke-width": e.width,
            "stroke-linejoin": "round",
          },
          g,
        );
        if (!preview)
          svg(
            "polyline",
            {
              points: pts,
              fill: "none",
              stroke: "transparent",
              "stroke-width": Math.max(e.width, 10 / workspace.zoom),
              "pointer-events": "stroke",
            },
            g,
          );
      } else {
        svg(
          "rect",
          {
            x: r.x,
            y: r.y,
            width: r.w,
            height: r.h,
            fill: "transparent",
            stroke: color,
            "stroke-width": e.width,
            "pointer-events": "all",
          },
          g,
        );
        const label = svg(
          "text",
          {
            x: r.x + r.w / 2,
            y: r.y + r.h / 2 + stampLayout(e).size * 0.35,
            fill: color,
            "font-family": "Helvetica, Arial, sans-serif",
            "font-weight": "bold",
            "font-size": stampLayout(e).size,
            "text-anchor": "middle",
            "pointer-events": "none",
          },
          g,
        );
        label.textContent = e.text || "PRELIMINÄR";
      }
      if (isSelected)
        e.points.forEach((p, i) =>
          svg(
            "rect",
            {
              x: p.x - 3.5 / workspace.zoom,
              y: p.y - 3.5 / workspace.zoom,
              width: 7 / workspace.zoom,
              height: 7 / workspace.zoom,
              fill: "#fff",
              stroke: "#147b60",
              "stroke-width": 1 / workspace.zoom,
              "data-grip": i,
              "data-id": e.id,
            },
            g,
          ),
        );
      return;
    }
    if (["freehand", "highlight"].includes(e.type)) {
      if (e.type === "highlight") g.style.mixBlendMode = "multiply";
      const attrs = {
        points: e.points.map((p) => `${p.x},${p.y}`).join(" "),
        fill: "none",
        stroke: isSelected ? "#2879c4" : e.color,
        "stroke-width": e.width,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      };
      svg("polyline", attrs, g);
      if (!preview)
        svg(
          "polyline",
          {
            ...attrs,
            stroke: "transparent",
            "stroke-width": Math.max(e.width, 10 / workspace.zoom),
            "pointer-events": "stroke",
          },
          g,
        );
      return;
    }
    if (e.type === "viewport") {
      const r = box(...e.points);
      svg(
        "rect",
        {
          x: r.x,
          y: r.y,
          width: r.w,
          height: r.h,
          fill: "none",
          stroke: isSelected ? "#147b60" : "#759a88",
          "stroke-width": 1 / workspace.zoom,
          "stroke-dasharray": `${5 / workspace.zoom} ${4 / workspace.zoom}`,
        },
        g,
      );
      svg(
        "rect",
        {
          x: r.x,
          y: r.y,
          width: r.w,
          height: r.h,
          fill: "none",
          stroke: "transparent",
          "stroke-width": 10 / workspace.zoom,
          "pointer-events": "stroke",
        },
        g,
      );
      if (e.showLabel) {
        const caption = viewportCaption(e);
        const text = svg(
          "text",
          {
            x: caption.p.x,
            y: caption.p.y,
            fill: "#263b35",
            "font-size": caption.size,
            "font-family": "Helvetica, Arial, sans-serif",
          },
          g,
        );
        text.textContent = caption.value;
      }
    }
    if (e.type === "block") {
      const a = e.points[0];
      const group = svg(
        "g",
        { transform: `translate(${a.x} ${a.y}) rotate(${e.rotation})` },
        g,
      );
      svg(
        "image",
        {
          href: e.preview,
          x: 0,
          y: 0,
          width: e.blockWidth,
          height: e.blockHeight,
          "pointer-events": "all",
        },
        group,
      );
      if (isSelected)
        svg(
          "rect",
          {
            x: 0,
            y: 0,
            width: e.blockWidth,
            height: e.blockHeight,
            fill: "none",
            stroke: "#147b60",
            "stroke-width": 1 / workspace.zoom,
          },
          group,
        );
    }
    for (const s of primitives(
      e,
      entityScale(e, displayState().entities, displayState().scales) || 1,
    )) {
      if (s.kind === "line") {
        svg(
          "line",
          {
            x1: s.a.x,
            y1: s.a.y,
            x2: s.b.x,
            y2: s.b.y,
            stroke: isSelected ? "#2879c4" : e.color,
            "stroke-width": e.width,
            "stroke-linecap": "round",
          },
          g,
        );
        if (!preview)
          svg(
            "line",
            {
              x1: s.a.x,
              y1: s.a.y,
              x2: s.b.x,
              y2: s.b.y,
              stroke: "transparent",
              "stroke-width": Math.max(e.width, 10 / workspace.zoom),
              "pointer-events": "stroke",
            },
            g,
          );
      }
      if (s.kind === "fillPath")
        svg(
          "polygon",
          {
            points: s.points.map((p) => `${p.x},${p.y}`).join(" "),
            fill: s.color,
          },
          g,
        );
      if (s.kind === "fill")
        svg(
          "rect",
          {
            x: s.rect.x,
            y: s.rect.y,
            width: s.rect.w,
            height: s.rect.h,
            fill: s.color || "white",
          },
          g,
        );
      if (s.kind === "text") {
        const n = svg(
          "text",
          {
            x: s.p.x,
            y: s.p.y,
            fill: e.color,
            "font-size": s.size,
            "font-family": "Helvetica, Arial, sans-serif",
          },
          g,
        );
        s.value.split("\n").forEach((l, i) => {
          const t = svg("tspan", { x: s.p.x, dy: i ? s.size * 1.25 : 0 }, n);
          t.textContent = l;
        });
      }
    }
    if (
      isSelected &&
      (!interaction.editOperation ||
        interaction.editOperation.phase === "select")
    )
      (e.type === "block"
        ? [e.points[0], blockCorners(e)[2]]
        : e.points
      ).forEach((p, i) =>
        svg(
          "rect",
          {
            x: p.x - 3.5 / workspace.zoom,
            y: p.y - 3.5 / workspace.zoom,
            width: 7 / workspace.zoom,
            height: 7 / workspace.zoom,
            fill: "#fff",
            stroke: "#147b60",
            "stroke-width": 1 / workspace.zoom,
            "data-grip": i,
            "data-id": e.id,
          },
          g,
        ),
      );
  }

  function releaseDocument(id) {
    for (const key of markupPreviews.keys())
      if (key.startsWith(`${id}:`)) markupPreviews.delete(key);
  }
  return { svg, prepareMarkupPreviews, drawEntity, releaseDocument };
}
