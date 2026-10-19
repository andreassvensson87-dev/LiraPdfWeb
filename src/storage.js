import { createIndexedDbRepository } from "./infrastructure/indexeddb-repository.js";

const repository = createIndexedDbRepository();
export const readSaved = () => repository.read("current");
export const writeSaved = (value) => repository.write("current", value);
export const readBlockLibrary = async () =>
  (await repository.read("block-library")) || [];
export const writeBlockLibrary = (blocks) =>
  repository.write("block-library", blocks);
