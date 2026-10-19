// Object selection and creation defaults are separate UI states.
export function createStyleControls($) {
  const defaults = new Map();
  const base = { color: "#147b60", width: 1.2, fontSize: 12, opacity: 1 };
  function read() {
    return {
      opacity:
        1 -
        Math.min(100, Math.max(0, Number($("transparency").value) || 0)) / 100,
      color: $("color").value,
      width: Math.min(20, Math.max(0.2, Number($("width").value) || 1.2)),
      fontSize: Math.min(96, Math.max(4, Number($("fontSize").value) || 12)),
    };
  }
  function restore(tool) {
    const value = defaults.get(tool) || {
      ...base,
      ...(tool === "highlight" ? { color: "#ffff00", width: 12 } : {}),
      ...(tool === "stamp" ? { color: "#b3261e", fontSize: 18 } : {}),
    };
    for (const key of ["color", "width", "fontSize"]) $(key).value = value[key];
    $("transparency").value = Math.round((1 - value.opacity) * 100);
  }
  function presentSelection(entity) {
    for (const key of ["color", "width", "fontSize"])
      $(key).value = entity[key];
    $("transparency").value = Math.round((1 - (entity.opacity ?? 1)) * 100);
  }
  function presentTool(type) {
    if (["circle", "ellipse"].includes(type)) $("circleShape").value = type;
  }
  return {
    read,
    restore,
    presentSelection,
    presentTool,
    remember: (tool) => defaults.set(tool, read()),
  };
}
