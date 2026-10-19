import { editableTypes, offsetTypes } from "../editing.js";

export function createEditToolDefinitions({}) {
  const transformTools = [
    "move",
    "copy",
    "offset",
    "rotate",
    "scale",
    "mirror",
    "erase",
    "join",
    "explode",
    "trim",
    "extend",
    "fillet",
    "chamfer",
    "pinsert",
    "pdelete",
  ];
  function editTypes(t) {
    if (t === "erase") return [...editableTypes, "viewport", "mask", "replace"];
    if (t === "offset") return offsetTypes;
    if (["rotate", "scale", "mirror"].includes(t))
      return ["line", "circle", "rect", "arc", "polyline"];
    if (["trim", "extend"].includes(t))
      return ["line", "rect", "polyline", "circle", "arc"];
    if (t === "join") return ["line", "polyline"];
    if (["explode", "pinsert", "pdelete"].includes(t))
      return ["rect", "polyline"];
    if (["fillet", "chamfer"].includes(t)) return ["line"];
    return editableTypes;
  }
  function editPhase(t) {
    if (["offset", "fillet", "chamfer"].includes(t)) return "distance";
    if (["trim", "extend"].includes(t)) return "cut";
    if (["pinsert", "pdelete"].includes(t)) return "vertex";
    if (["erase", "join", "explode"].includes(t)) return "select";
    return "base";
  }

  return { transformTools, editTypes, editPhase };
}
