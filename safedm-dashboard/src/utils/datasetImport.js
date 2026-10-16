const MESSAGE_ALIASES = ["message", "text", "body", "content", "sms"];
const LABEL_ALIASES = ["expected", "label", "class", "target", "category"];

export function parseDatasetFile(name, text) {
  if (name.toLowerCase().endsWith(".json") || /^[\s]*[{[]/.test(text)) {
    const value = JSON.parse(text);
    const rows = Array.isArray(value) ? value : value.items || value.data || value.examples;
    if (!Array.isArray(rows)) throw new Error("Le JSON doit contenir une liste d’exemples.");
    return { columns: Object.keys(rows[0] || {}), rows };
  }
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { columns: [], rows: [] };
  const split = (line) => {
    const cells = []; let cell = ""; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
      else cell += char;
    }
    cells.push(cell); return cells;
  };
  const columns = split(lines[0]).map((value) => value.trim());
  return { columns, rows: lines.slice(1).map((line) => Object.fromEntries(split(line).map((v, i) => [columns[i], v]))) };
}

export function suggestColumn(columns, aliases) {
  return columns.find((column) => aliases.includes(column.toLowerCase().trim())) || columns[0] || "";
}

export function normalizeDatasetRows(rows, messageColumn, labelColumn) {
  return rows.map((row, index) => {
    const message = String(row[messageColumn] ?? "").trim();
    const raw = String(row[labelColumn] ?? "").trim().toLowerCase();
    const benign = ["benign", "safe", "ham", "ok", "legit", "legitimate", "bénin", "benin", "sain", "0"].includes(raw);
    const malicious = ["malicious", "phishing", "spam", "fraud", "scam", "malveillant", "dangereux", "1"].includes(raw);
    // The trainer's BENIGN_LABELS currently accepts "legitimate" and "benign_marketing".
    return { index, message, expected: benign ? "legitimate" : malicious ? "malicious" : raw, valid: Boolean(message && (benign || malicious)) };
  }).filter((row) => row.message);
}

export const DATASET_COLUMN_ALIASES = { message: MESSAGE_ALIASES, label: LABEL_ALIASES };
