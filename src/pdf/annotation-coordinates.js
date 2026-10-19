import { number } from "./annotation-values.js";
// PDF.js's scale-1 viewport coordinates, including crop origin, rotation and UserUnit.
export function annotationCoordinates(page) {
  const media = page.getMediaBox(),
    crop = page.getCropBox();
  let left = Math.max(media.x, crop.x),
    bottom = Math.max(media.y, crop.y);
  let right = Math.min(media.x + media.width, crop.x + crop.width);
  let top = Math.min(media.y + media.height, crop.y + crop.height);
  if (right <= left || top <= bottom) {
    ({ x: left, y: bottom } = media);
    right = left + media.width;
    top = bottom + media.height;
  }
  const unit = number(page.node, "UserUnit", 1);
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  return {
    unit,
    fromPdf(x, y) {
      const coordinates = {
        0: [x - left, top - y],
        90: [y - bottom, x - left],
        180: [right - x, y - bottom],
        270: [top - y, right - x],
      }[rotation];
      if (!coordinates) throw Error("Sidrotationen stöds inte.");
      return { x: coordinates[0] * unit, y: coordinates[1] * unit };
    },
  };
}
