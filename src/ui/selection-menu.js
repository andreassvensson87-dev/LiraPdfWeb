import { setupObjectMenu } from "../object-menu.js";

export function createSelectionMenu({
  workspace,
  interaction,
  session,
  $,
  document,
  setTool,
  select,
  changeGrouping,
}) {
  let contextObjectId = null;
  const objectMenu = setupObjectMenu({
    host: $("viewport"),
    open: (event) => {
      if (
        !workspace.pdf ||
        workspace.busy ||
        interaction.pendingDialog ||
        interaction.drag ||
        document.querySelector("dialog[open]")
      )
        return null;
      const id = event.target.closest("[data-id]")?.dataset.id;
      const hit = session.state.entities.find(
        (e) => e.id === id && e.type !== "pdfErase",
      );
      contextObjectId = hit?.id || null;
      if (interaction.tool !== "select") setTool("select");
      if (hit && !interaction.selection.has(hit.id)) select(hit.id);
      if (!interaction.selection.size) return null;
      const chosen = session.state.entities.filter((e) =>
        interaction.selection.has(e.id),
      );
      const alreadyGrouped =
        chosen.length > 1 &&
        chosen.every((e) => e.groupId && e.groupId === chosen[0].groupId);
      return [
        {
          label: "Gruppera",
          action: "group",
          disabled: chosen.length < 2 || alreadyGrouped,
        },
        {
          label: "Lös upp grupp",
          action: "ungroup",
          disabled: !chosen.some((e) => e.groupId),
        },
        ...(hit?.groupId
          ? [{ label: "Välj enskilt objekt", action: "individual" }]
          : []),
      ];
    },
    actions: {
      group: () => changeGrouping(),
      ungroup: () => changeGrouping(true),
      individual: () => select(contextObjectId, true),
    },
  });
  return { objectMenu };
}
