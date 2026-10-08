function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

// View position and implicit defaults do not change the document's content.
export function documentSnapshot(state) {
  return JSON.stringify(
    canonical({
      entities: state.entities || [],
      scales: state.scales || {},
      rotations: Object.fromEntries(
        Object.entries(state.rotations || {}).filter(
          ([, rotation]) => rotation !== 0,
        ),
      ),
    }),
  );
}

export function documentChanged(state, savedState) {
  try {
    return documentSnapshot(state) !== documentSnapshot(JSON.parse(savedState));
  } catch {
    return true;
  }
}
