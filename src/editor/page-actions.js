import { normalizeRotation } from "../page-rotation.js";

export function createPageActions({
  workspace,
  interaction,
  setTool,
  clone,
  session,
  commit,
  fit,
  toast,
}) {
  function rotateCurrentPage(amount) {
    if (
      !workspace.pdf ||
      !workspace.viewport ||
      workspace.busy ||
      interaction.pendingDialog
    )
      return;
    setTool("select");
    const next = clone(session.state);
    next.rotations ||= {};
    next.rotations[workspace.pageNo] = normalizeRotation(
      (next.rotations[workspace.pageNo] || 0) + amount,
    );
    commit(next);
    fit();
    toast(amount > 0 ? "Sidan roterad 90° medurs" : "Sidan roterad 90° moturs");
  }
  return { rotateCurrentPage };
}
