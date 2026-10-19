import { parseAst } from "rollup/parseAst";
import { posix } from "node:path";

const browserNames = new Set([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "HTMLElement",
  "ResizeObserver",
]);
function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node !== "object") return;
  if (node.type) visit(node, parent, key);
  for (const [name, value] of Object.entries(node)) {
    if (Array.isArray(value))
      value.forEach((child) => walk(child, visit, node, name));
    else if (value && typeof value === "object") walk(value, visit, node, name);
  }
}
export function inspectModule(
  source,
  { domFree = false, storageFree = false } = {},
) {
  const imports = new Set();
  const ast = parseAst(source);
  walk(ast, (node, parent, key) => {
    if (
      [
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
      ].includes(node.type) &&
      node.source
    )
      imports.add(node.source.value);
    if (node.type === "ImportExpression") {
      if (
        node.source.type !== "Literal" ||
        typeof node.source.value !== "string"
      )
        throw Error("Dynamisk import måste ange en uttrycklig modul.");
      imports.add(node.source.value);
    }
    if (node.type === "Identifier") {
      const property =
        (parent?.type === "MemberExpression" &&
          key === "property" &&
          !parent.computed) ||
        (parent?.type === "Property" && key === "key" && !parent.computed);
      if (!property && domFree && browserNames.has(node.name))
        throw Error(`Browserberoende i DOM-fri modul: ${node.name}`);
      if (
        !property &&
        storageFree &&
        ["indexedDB", "localStorage", "sessionStorage"].includes(node.name)
      )
        throw Error(
          `Direkt browserlagring utanför lagringsadaptern: ${node.name}`,
        );
    }
    if (node.type === "MemberExpression" && node.object.name === "globalThis") {
      const name = node.computed ? node.property.value : node.property.name;
      if (domFree && browserNames.has(name))
        throw Error(`Browserberoende i DOM-fri modul: globalThis.${name}`);
      if (
        storageFree &&
        ["indexedDB", "localStorage", "sessionStorage"].includes(name)
      )
        throw Error(
          `Direkt browserlagring utanför lagringsadaptern: globalThis.${name}`,
        );
    }
  });
  return [...imports];
}
export function verifyArchitecture(sources, registry) {
  const ownership = new Map();
  for (const [layer, group] of Object.entries(registry.layers)) {
    for (const file of group.files) {
      if (ownership.has(file)) throw Error(`Dubbelt modulansvar: ${file}`);
      if (!sources.has(file)) throw Error(`Modul saknas på disk: ${file}`);
      ownership.set(file, layer);
    }
  }
  const graph = new Map();
  for (const [file, source] of sources) {
    const layer = ownership.get(file);
    if (!layer) throw Error(`Modulansvar saknas: ${file}`);
    const rules = registry.layers[layer];
    let imports;
    try {
      imports = file.endsWith(".css")
        ? [...source.matchAll(/@import\s+["']([^"']+)["']/g)].map(
            (match) => match[1],
          )
        : inspectModule(source, {
            domFree: rules.domFree,
            storageFree: layer !== "infrastructure",
          });
    } catch (error) {
      throw Error(`${file}: ${error.message}`);
    }
    const dependencies = [];
    for (const specifier of imports) {
      if (!specifier.startsWith(".")) {
        if (layer === "model")
          throw Error(
            `Externt paket i dokumentmodellen: ${file} → ${specifier}`,
          );
        continue;
      }
      const target = posix.normalize(
        posix.join(posix.dirname(file), specifier.split("?")[0]),
      );
      const targetLayer = ownership.get(target);
      if (!targetLayer) throw Error(`Okänd import: ${file} → ${target}`);
      if (!rules.mayImport.includes(targetLayer))
        throw Error(`Otillåtet lagerberoende: ${file} → ${target}`);
      dependencies.push(target);
    }
    graph.set(file, dependencies);
  }
  const visited = new Set(),
    active = [];
  function visit(file) {
    if (active.includes(file))
      throw Error(
        `Cirkulärt modulberoende: ${[...active.slice(active.indexOf(file)), file].join(" → ")}`,
      );
    if (visited.has(file)) return;
    active.push(file);
    graph.get(file).forEach(visit);
    active.pop();
    visited.add(file);
  }
  for (const file of graph.keys()) visit(file);
  return graph;
}
