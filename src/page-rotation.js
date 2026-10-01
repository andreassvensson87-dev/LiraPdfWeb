export const normalizeRotation = (angle) => ((angle % 360) + 360) % 360;
export function pageRotation(width, height, angle = 0) {
  const rotation = normalizeRotation(angle);
  const matrix = {
    0: [1, 0, 0, 1, 0, 0],
    90: [0, 1, -1, 0, height, 0],
    180: [-1, 0, 0, -1, width, height],
    270: [0, -1, 1, 0, 0, width],
  }[rotation];
  if (!matrix) throw Error("Sidrotation måste vara ett helt kvartsvarv.");
  const [a, b, c, d, e, f] = matrix;
  return {
    rotation,
    matrix,
    width: rotation % 180 ? height : width,
    height: rotation % 180 ? width : height,
    forward: (p) => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }),
    inverse: (p) => ({
      x: a * (p.x - e) + b * (p.y - f),
      y: c * (p.x - e) + d * (p.y - f),
    }),
  };
}
