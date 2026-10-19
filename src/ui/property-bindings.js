export function bindPropertyControls({
  $,
  style,
  interaction,
  editProperties,
  refresh,
  rememberStyle,
  canEdit,
  error,
  copyBlock,
}) {
  function apply(action) {
    if (!canEdit()) return;
    try {
      action();
    } catch (exception) {
      error(exception);
    }
    refresh();
  }
  $("transparency").oninput = () => {
    if (!canEdit()) return;
    $("transparencyValue").value = `${$("transparency").value} %`;
    // Preview the SVG; commit once on release to preserve one undo step.
    const opacity = style().opacity;
    for (const node of $("overlay").querySelectorAll("g.entity[data-id]"))
      if (interaction.selection.has(node.dataset.id))
        node.setAttribute("opacity", opacity);
  };
  $("transparency").onchange = () =>
    apply(() => {
      const opacity = style().opacity;
      $("transparency").value = Math.round((1 - opacity) * 100);
      if (interaction.selection.size) editProperties.opacity(opacity);
      else rememberStyle(interaction.tool);
    });
  for (const key of ["color", "width", "fontSize"])
    $(key).onchange = () =>
      apply(() => {
        if (interaction.selection.size) editProperties.appearance(style());
        else rememberStyle(interaction.tool);
      });
  for (const id of ["blockSize", "blockRotation"])
    $(id).onchange = () =>
      apply(() => editProperties.blockProperty(id, Number($(id).value)));
  for (const id of ["viewportName", "viewportLabel"])
    $(id).onchange = () =>
      apply(() =>
        editProperties.viewportIdentity(
          $("viewportName").value,
          $("viewportLabel").checked,
        ),
      );
  $("viewportScale").onchange = () =>
    apply(() => editProperties.viewportScale(Number($("viewportScale").value)));
  $("copyBlock").onclick = copyBlock;
}
