import { validateDocumentState } from "./document-validation.js";

// Project serialization has an envelope; the in-memory model does not.
export function validateProject(project) {
  if (
    project?.format !== "lirapdf" ||
    project.version !== 1 ||
    typeof project.pdf !== "string"
  )
    throw Error("Ogiltig LiraPDF-projektfil.");
  return validateDocumentState(project);
}
