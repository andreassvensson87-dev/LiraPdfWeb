// Compatibility exports. Internal modules import the owner directly.
export {
  distance,
  box,
  constrain,
  arcPoints,
  dimension,
} from "./model/geometry.js";
export { primitives } from "./model/entity-primitives.js";
export { validateProject } from "./model/project-format.js";
