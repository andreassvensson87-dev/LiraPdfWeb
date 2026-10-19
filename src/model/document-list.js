export function matchingDocuments(documents, query) {
  const words = query
    .trim()
    .toLocaleLowerCase("sv-SE")
    .split(/\s+/)
    .filter(Boolean);
  return documents.filter((d) =>
    words.every((word) => d.name.toLocaleLowerCase("sv-SE").includes(word)),
  );
}
export function reorderDocuments(documents, id, targetId, after = false) {
  if (id === targetId) return documents;
  const source = documents.find((d) => d.id === id);
  if (!source || !documents.some((d) => d.id === targetId)) return documents;
  const next = documents.filter((d) => d.id !== id);
  const index = next.findIndex((d) => d.id === targetId) + Number(after);
  next.splice(index, 0, source);
  return next.every((d, i) => d === documents[i]) ? documents : next;
}
