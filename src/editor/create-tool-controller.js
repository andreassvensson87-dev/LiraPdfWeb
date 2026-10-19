import { counts } from "./tool-catalog.js";
import { distance, box, arcPoints, dimension } from "../model/geometry.js";

export function createCreationController({
  interaction,
  toast,
  workspace,
  scaleContext,
  refresh,
  clearTracking,
  clone,
  ask,
  session,
  style,
  commit,
  setTool,
  select,
  stampText,
  canvasText,
  error,
}) {
  async function addPoint(p) {
    if (["freehand", "highlight"].includes(interaction.tool)) {
      toast("Håll ned och dra i ritningen för att rita på fri hand.");
      return;
    }
    if (workspace.busy || interaction.pendingDialog || !workspace.viewport)
      return;
    if (
      interaction.tool === "dim" &&
      !interaction.points.length &&
      !scaleContext(p).scale
    ) {
      toast(
        "Kalibrera pappret eller välj en startpunkt i en viewport innan du måttsätter.",
      );
      return;
    }
    interaction.points.push(p);
    if (interaction.points.length < counts[interaction.tool]) {
      refresh();
      return;
    }
    clearTracking();
    const type = interaction.tool,
      ps = clone(interaction.points);
    interaction.points = [];
    try {
      if (type === "viewport") {
        const r = box(...ps);
        if (r.w < 1 || r.h < 1)
          throw Error("Viewporten måste ha bredd och höjd.");
        const answer = await ask(
          "Viewportskala",
          "Ange nämnaren: 100 betyder skala 1:100. Papprets skala gäller utanför rutan.",
          "100",
          true,
        );
        if (answer === null) return;
        const denominator = Number(answer);
        if (
          !Number.isFinite(denominator) ||
          denominator < 1 ||
          denominator > 100000
        )
          throw Error("Ange en skala mellan 1:1 och 1:100000.");
        const e = {
          id: crypto.randomUUID(),
          type,
          page: workspace.pageNo,
          points: [
            { x: r.x, y: r.y },
            { x: r.x + r.w, y: r.y + r.h },
          ],
          denominator,
          name: `Vy ${session.state.entities.filter((e) => e.type === "viewport").length + 1}`,
          showLabel: true,
          ...style(),
        };
        const next = clone(session.state);
        next.entities.push(e);
        commit(next);
        setTool("select");
        select(e.id);
        return;
      }
      if (type === "calibrate") {
        const d = distance(...ps);
        if (d < 0.01) throw Error("Välj två olika punkter.");
        const value = await ask(
          "Kalibrera skala",
          "Ange det verkliga avståndet mellan punkterna i millimeter.",
          "6000",
          true,
        );
        if (value === null) return;
        const mm = Number(value);
        if (!Number.isFinite(mm) || mm <= 0)
          throw Error("Avståndet måste vara större än noll.");
        const next = clone(session.state);
        next.scales[workspace.pageNo] = mm / d;
        commit(next);
        setTool("dim");
        return;
      }
      let text = "",
        replacementStyle = null;
      if (type === "arc") arcPoints(...ps);
      if (
        type === "ellipse" &&
        (Math.abs(ps[1].x - ps[0].x) < 0.1 || Math.abs(ps[1].y - ps[0].y) < 0.1)
      )
        throw Error("Ellipsen behöver både bredd och höjd.");
      if (
        ["cloud", "stamp"].includes(type) &&
        (box(...ps).w < 10 || box(...ps).h < 10)
      )
        throw Error("Välj ett område som är minst 10 × 10 punkter.");
      if (type === "stamp") {
        text = stampText();
        if (text === "custom")
          text = await canvasText(
            { type: "stamp", points: ps, ...style() },
            "PRELIMINÄR",
          );
        if (text === null || !text.trim()) return;
        text = text.trim();
        if (text.length > 100 || /[\r\n]/.test(text))
          throw Error("Använd en rad med högst 100 tecken.");
      }
      if (type === "dim") dimension(...ps);
      if (
        ["line", "circle", "rect", "replace", "mask"].includes(type) &&
        distance(...ps) < 0.1
      )
        throw Error("Objektet är för litet.");
      if (["text", "leader", "replace"].includes(type)) {
        let initial = "";
        if (type === "replace") {
          const r = box(...ps);
          const hits = workspace.textItems
            .filter((t) => t.str?.trim())
            .map((t) => {
              const [x, y] = workspace.viewport.convertToViewportPoint(
                t.transform[4],
                t.transform[5],
              );
              const h = Math.max(1, t.height);
              const [ex, ey] = workspace.viewport.convertToViewportPoint(
                t.transform[4] + t.width,
                t.transform[5] + h,
              );
              return {
                t,
                x: Math.min(x, ex),
                y: Math.min(y, ey),
                w: Math.abs(ex - x),
                h: Math.abs(ey - y),
                baseline: { x, y },
              };
            })
            .filter(
              (t) =>
                t.x < r.x + r.w &&
                t.x + t.w > r.x &&
                t.y < r.y + r.h &&
                t.y + t.h > r.y,
            );
          if (hits.length) {
            initial = hits
              .map(({ t }) => t.str + (t.hasEOL ? "\n" : " "))
              .join("")
              .trim();
            const left = Math.min(...hits.map((t) => t.x)) - 1,
              top = Math.min(...hits.map((t) => t.y)) - 1,
              right = Math.max(...hits.map((t) => t.x + t.w)) + 1,
              bottom = Math.max(...hits.map((t) => t.y + t.h)) + 2;
            ps[0] = { x: left, y: top };
            ps[1] = { x: right, y: bottom };
            replacementStyle = {
              color: "#263d43",
              fontSize: Math.max(4, hits[0].t.height),
              textAnchor: hits[0].baseline,
            };
          }
        }
        text = await canvasText(
          { type, points: ps, ...style(), ...(replacementStyle || {}) },
          initial,
        );
        if (text === null || !text.trim()) return;
      }
      const e = {
        id: crypto.randomUUID(),
        type,
        page: workspace.pageNo,
        points: ps,
        text,
        ...style(),
        ...(type === "dim"
          ? { measurementScale: scaleContext(ps[0]).scale }
          : {}),
        ...(type === "mask" ? { color: "#ffffff" } : {}),
        ...(replacementStyle || {}),
        ...(["line", "circle", "rect", "arc", "text", "leader", "dim"].includes(
          type,
        )
          ? { viewportId: scaleContext(ps[0]).owner?.id }
          : {}),
      };
      const next = clone(session.state);
      next.entities.push(e);
      commit(next);
      if (type === "line") interaction.points = [ps[1]];
      if (["text", "stamp"].includes(type)) {
        setTool("select");
        select(e.id);
      }
    } catch (e) {
      if (type === "line") interaction.points = [ps[0]];
      error(e);
    } finally {
      refresh();
    }
  }

  return { addPoint };
}
