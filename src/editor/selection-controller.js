import { expandGroups } from "../groups.js";

export function createSelectionController({
  interaction,
  session,
  current,
  presentSelection,
  refresh,
  showProperties,
}) {
  function select(id, individual = false) {
    interaction.activeGrip = null;
    interaction.selection.clear();
    if (id)
      (individual ? [id] : expandGroups(session.state.entities, [id])).forEach(
        (id) => interaction.selection.add(id),
      );
    interaction.selected = interaction.selection.size === 1 ? id : null;
    const e = current();
    if (e) {
      showProperties();
      presentSelection(e);
    }
    refresh();
  }

  return { select };
}
