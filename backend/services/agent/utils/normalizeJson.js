export function normalizeJson(content) {
  const rawText = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => typeof part === "string" ? part : part?.text ?? "").join("")
      : String(content ?? "");
  const text = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let normalized = "";
  let inString = false;
  let escaped = false;

  for (const character of text) {
    const code = character.charCodeAt(0);

    if (inString && code < 0x20) {
      if (character === "\n") normalized += "\\n";
      else if (character === "\r") normalized += "\\r";
      else if (character === "\t") normalized += "\\t";
      else normalized += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }

    normalized += character;
    if (!inString) {
      if (character === '"') inString = true;
    } else if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      inString = false;
    }
  }

  return JSON.parse(normalized);
}
