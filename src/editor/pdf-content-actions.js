import { textTargetAt } from "../model/text-hit-testing.js";
import { findRemovableLine } from "../pdf-line-edit.js";

// Command rules for source PDF edits and block placement. Pointer events only
// provide a resolved document point; every mutation uses the document editor.
export function createPdfContentActions({
  interaction,
  workspace,
  session,
  clone,
  style,
  scaleContext,
  commit,
  setTool,
  select,
  toast,
  error,
  pdfLineAt,
}) {
  async function pick(p) {
    if (interaction.tool === "block" && interaction.pendingBlock) {
      const entity = {
        ...clone(interaction.pendingBlock),
        id: crypto.randomUUID(),
        page: workspace.pageNo,
        ...(interaction.pendingBlock.isPdfStamp
          ? {}
          : { viewportId: scaleContext(p).owner?.id }),
        points: [p],
      };
      const next = clone(session.state);
      next.entities.push(entity);
      commit(next);
      setTool("select");
      select(entity.id);
      return;
    }
    if (interaction.tool === "eraseText") {
      const hit = textTargetAt(workspace.removableTextTargets, p);
      if (!hit) {
        toast(
          "Ingen borttagbar text här. Text i bilder, block eller med sammansatt kodning stöds ännu inte. Använd Maska vid behov.",
        );
        return;
      }
      const next = clone(session.state);
      next.entities.push({
        id: crypto.randomUUID(),
        type: "pdfErase",
        page: workspace.pageNo,
        points: [hit.polygon[0], hit.polygon[2]],
        ...style(),
        eraseTextOffset: hit.offset,
      });
      commit(next);
      toast("PDF-texten har tagits bort. Ångra återställer den.");
      return;
    }
    if (["coverLine", "eraseLine"].includes(interaction.tool)) {
      const segment = pdfLineAt(p);
      if (!segment) {
        toast("Ingen rak PDF-linje här.");
        return;
      }
      const e = {
        id: crypto.randomUUID(),
        page: workspace.pageNo,
        points: [{ ...segment.a }, { ...segment.b }],
        ...style(),
      };
      if (interaction.tool === "coverLine") {
        e.type = "line";
        e.color = "#ffffff";
        e.width = 4;
        const next = clone(session.state);
        next.entities.push(e);
        commit(next);
        setTool("select");
        select(e.id);
        toast(
          "Linjen är täckt med vitt. Justera linjebredden vid behov. Originalet finns kvar.",
        );
      } else {
        workspace.busy = true;
        try {
          const hit = await findRemovableLine(
            workspace.bytes,
            workspace.pageNo,
            segment,
            workspace.viewport,
          );
          if (
            !hit ||
            session.state.entities.some(
              (x) =>
                x.type === "pdfErase" &&
                x.page === workspace.pageNo &&
                x.eraseOffset === hit.offset,
            )
          ) {
            toast(
              "Den här linjen ingår i en sammansatt figur, ett block eller en bild. Använd Täck linje för visuell täckning.",
            );
            return;
          }
          e.type = "pdfErase";
          e.eraseOffset = hit.offset;
          const next = clone(session.state);
          next.entities.push(e);
          workspace.busy = false;
          await commit(next);
          toast("PDF-linjen har tagits bort. Ångra återställer den.");
        } catch (err) {
          error(err);
        } finally {
          workspace.busy = false;
        }
      }
      return;
    }
    if (interaction.tool === "extract") {
      const segment = pdfLineAt(p);
      if (!segment) {
        toast("Ingen rak PDF-linje här. Skannade bilder kan inte hämtas.");
        return;
      }
      const entity = {
        id: crypto.randomUUID(),
        type: "line",
        page: workspace.pageNo,
        points: [{ ...segment.a }, { ...segment.b }],
        ...style(),
      };
      const next = clone(session.state);
      next.entities.push(entity);
      commit(next);
      setTool("select");
      select(entity.id);
      toast(
        "Linjen är kopierad och kan redigeras. Originalet finns kvar i PDF-underlaget.",
      );
      return;
    }
  }
  return { pick };
}
