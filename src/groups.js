export function expandGroups(entities, ids) {
  const picked = new Set(ids);
  const groups = new Set(
    entities
      .filter((e) => picked.has(e.id) && e.groupId)
      .map((e) => `${e.page}:${e.groupId}`),
  );
  return entities
    .filter(
      (e) =>
        picked.has(e.id) || (e.groupId && groups.has(`${e.page}:${e.groupId}`)),
    )
    .map((e) => e.id);
}

export function groupObjects(entities, ids, groupId) {
  const members = new Set(expandGroups(entities, ids));
  const objects = entities.filter((e) => members.has(e.id));
  if (objects.length < 2)
    throw Error("Markera minst två objekt för att gruppera.");
  if (
    objects.some((e) => e.type === "pdfErase") ||
    new Set(objects.map((e) => e.page)).size !== 1
  )
    throw Error("Grupper måste bestå av objekt på samma sida.");
  return entities.map((e) => (members.has(e.id) ? { ...e, groupId } : e));
}

export function ungroupObjects(entities, ids) {
  const members = new Set(expandGroups(entities, ids));
  return entities.map((e) => {
    if (!members.has(e.id)) return e;
    const copy = { ...e };
    delete copy.groupId;
    return copy;
  });
}

export function normalizeGroups(entities) {
  const counts = new Map();
  for (const e of entities)
    if (e.groupId)
      counts.set(
        `${e.page}:${e.groupId}`,
        (counts.get(`${e.page}:${e.groupId}`) || 0) + 1,
      );
  for (const e of entities)
    if (e.groupId && counts.get(`${e.page}:${e.groupId}`) < 2) delete e.groupId;
}

// Copies form new groups, so moving a copy never moves its original.
export function copyGroupIds(entities, newId) {
  const groups = new Map();
  return entities.map((e) => {
    const copy = { ...e, id: newId() };
    if (e.groupId) {
      if (!groups.has(e.groupId)) groups.set(e.groupId, newId());
      copy.groupId = groups.get(e.groupId);
    }
    return copy;
  });
}
