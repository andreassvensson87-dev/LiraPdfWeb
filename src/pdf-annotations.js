// Compatibility facade for annotation import/export consumers.
export { annotationCoordinates } from "./pdf/annotation-coordinates.js";
export { importAnnotations } from "./pdf/annotation-import.js";
export { isStandardEntity, writeAnnotations } from "./pdf/annotation-writer.js";
export { pruneUnusedObjects } from "./pdf/object-graph.js";
