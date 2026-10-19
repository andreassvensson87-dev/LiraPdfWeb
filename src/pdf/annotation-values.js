import { PDFArray, PDFName, PDFNumber, PDFString, PDFHexString } from "pdf-lib";
export const key = (name) => PDFName.of(name);
export const archiveKey = key("LiraAnnotationSources");
export const value = (dict, name) => dict.lookup(key(name));
export const number = (dict, name, fallback) => {
  const v = value(dict, name);
  return v instanceof PDFNumber ? v.asNumber() : fallback;
};
export const numbers = (array) => {
  if (!(array instanceof PDFArray)) return null;
  const result = array.asArray().map((_, i) => array.lookup(i));
  return result.every(
    (v) => v instanceof PDFNumber && Number.isFinite(v.asNumber()),
  )
    ? result.map((v) => v.asNumber())
    : null;
};
export const text = (v) =>
  v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : null;
