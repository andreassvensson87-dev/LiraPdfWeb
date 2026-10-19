export function createFeedback({ $ }) {
  let toastTimer;
  function toast(t) {
    $("toast").textContent = t;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => {
        $("toast").hidden = true;
      },
      Math.min(14000, Math.max(5000, t.length * 45)),
    );
  }
  function error(e) {
    console.error(e);
    toast(e.message || String(e));
  }

  return { toast, error };
}
