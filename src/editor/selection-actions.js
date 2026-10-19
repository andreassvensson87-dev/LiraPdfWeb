import { expandGroups, groupObjects, ungroupObjects } from "../groups.js";

export function createSelectionActions({
  current,
  canvasText,
  toast,
  clone,
  session,
  commit,
  interaction,
  workspace,
  error,
  setTool,
}) {
  async function editText() {
    const e = current();
    if (!e || !["text", "leader", "replace", "stamp"].includes(e.type)) return;
    const value = await canvasText(e, e.text);
    if (value !== null && value.trim()) {
      if (e.type === "stamp" && (value.length > 100 || /[\r\n]/.test(value))) {
        toast("Använd en rad med högst 100 tecken.");
        return;
      }
      const next = clone(session.state);
      next.entities.find((n) => n.id === e.id).text = value;
      commit(next);
    }
  }
  function remove() {
    if (!interaction.selection.size) return;
    const ids = new Set(interaction.selection),
      next = clone(session.state);
    next.entities = next.entities.filter(
      (e) => !ids.has(e.id) && !ids.has(e.viewportId),
    );
    interaction.selected = null;
    interaction.selection.clear();
    commit(next);
  }

  function changeGrouping(ungroup = false) {
    if (
      workspace.busy ||
      interaction.pendingDialog ||
      !interaction.selection.size
    )
      return;
    const next = clone(session.state);
    try {
      next.entities = ungroup
        ? ungroupObjects(next.entities, [...interaction.selection])
        : groupObjects(
            next.entities,
            [...interaction.selection],
            crypto.randomUUID(),
          );
      if (!ungroup) {
        const members = expandGroups(next.entities, [...interaction.selection]);
        interaction.selection.clear();
        members.forEach((id) => interaction.selection.add(id));
        interaction.selected = null;
      }
      commit(next);
      toast(
        ungroup
          ? "Gruppen är upplöst."
          : "Objekten är grupperade. Ctrl/⌘-klick väljer ett enskilt objekt.",
      );
    } catch (e) {
      error(e);
    }
  }
  function copyBlock() {
    if (
      workspace.busy ||
      interaction.pendingDialog ||
      current()?.type !== "block"
    )
      return;
    interaction.pendingBlock = clone(current());
    delete interaction.pendingBlock.id;
    delete interaction.pendingBlock.groupId;
    setTool("block");
  }
  return { editText, remove, changeGrouping, copyBlock };
}
