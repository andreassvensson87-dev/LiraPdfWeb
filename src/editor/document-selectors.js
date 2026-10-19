import { viewportAt, mmPerPoint } from "../viewports.js";

export function createDocumentSelectors({ session, workspace, interaction }) {
  const displayState = () =>
    interaction.drag?.kind === "entity" && interaction.drag.preview
      ? interaction.drag.preview
      : session.state;
  const current = () =>
    displayState().entities.find(
      (entity) => entity.id === interaction.selected,
    );
  const pageEntities = () =>
    displayState().entities.filter(
      (entity) => entity.page === workspace.pageNo,
    );
  function scaleContext(point) {
    const owner = viewportAt(session.state.entities, workspace.pageNo, point);
    return {
      owner,
      scale: owner
        ? owner.denominator * mmPerPoint
        : session.state.scales[workspace.pageNo],
    };
  }
  return { displayState, current, pageEntities, scaleContext };
}
