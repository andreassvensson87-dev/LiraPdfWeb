import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyArchitecture } from "./source-architecture.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
async function list(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? list(resolve(directory, entry.name))
          : [resolve(directory, entry.name)],
      ),
    )
  ).flat();
}
const files = (await list(resolve(root, "src"))).filter((file) =>
  /\.(js|css)$/.test(file),
);
const sources = new Map(
  await Promise.all(
    files.map(async (file) => [
      relative(root, file),
      await readFile(file, "utf8"),
    ]),
  ),
);
const registry = JSON.parse(
  await readFile(resolve(root, "docs/module-responsibilities.json"), "utf8"),
);
verifyArchitecture(sources, registry);
console.log(
  `Syntax, modulansvar och lagergränser kontrollerade för ${files.length} källfiler; inga cirkulära beroenden.`,
);
