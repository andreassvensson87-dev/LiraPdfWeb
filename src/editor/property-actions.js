import { changeViewportScale } from "../viewports.js";
/** Property rules produce drafts; commit remains the only document write path. */
export function createPropertyActions({
  session,
  interaction,
  commit,
  canEdit,
}) {
  function change(ids, update) {
    if (!canEdit() || !ids.length) return;
    const next = structuredClone(session.state);
    for (const entity of next.entities)
      if (ids.includes(entity.id)) update(entity);
    commit(next);
  }
  function selected(type) {
    return session.state.entities.find(
      (entity) =>
        entity.id === interaction.selected && (!type || entity.type === type),
    );
  }
  return {
    appearance(appearance) {
      const entity = selected();
      if (!entity || ["pdfMarkup", "viewport", "block"].includes(entity.type))
        return;
      change([entity.id], (draft) => Object.assign(draft, appearance));
    },
    opacity(opacity) {
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
        throw Error("Ogiltig genomskinlighet.");
      change([...interaction.selection], (draft) => {
        if (draft.type !== "pdfMarkup") draft.opacity = opacity;
      });
    },
    blockProperty(property, value) {
      const entity = selected("block");
      if (!entity) return;
      if (
        !Number.isFinite(value) ||
        (property === "blockSize" && (value < 1 || value > 10000))
      )
        throw Error("Ogiltig blockstorlek eller rotation.");
      change([entity.id], (draft) => {
        if (property === "blockSize") {
          draft.blockWidth = (draft.naturalWidth * value) / 100;
          draft.blockHeight = (draft.naturalHeight * value) / 100;
        } else if (property === "blockRotation")
          draft.rotation = ((value % 360) + 360) % 360;
      });
    },
    viewportScale(denominator) {
      if (!canEdit() || !selected("viewport")) return;
      commit(
        changeViewportScale(session.state, interaction.selected, denominator),
      );
    },
    viewportIdentity(name, showLabel) {
      const entity = selected("viewport");
      if (!entity) return;
      change([entity.id], (draft) => {
        draft.name = name.trim().slice(0, 100) || "Viewport";
        draft.showLabel = showLabel;
      });
    },
  };
}
