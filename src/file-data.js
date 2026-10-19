// Browser file transfer and binary encoding; no editor or UI ownership.
export function download(data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function base64(data) {
  let s = "";
  for (let i = 0; i < data.length; i += 32768)
    s += String.fromCharCode(...data.subarray(i, i + 32768));
  return btoa(s);
}
