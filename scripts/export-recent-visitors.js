const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const OUTPUT_FILE = path.join(DATA_DIR, "recent-visitors.csv");
const CUTOFF = new Date("2025-04-01T00:00:00");

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (line[i] === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += line[i];
      }
    }
    values.push(current);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || "").trim()]));
  });
}

function parseTimestamp(ts) {
  // "YYYY/MM/DD HH:mm:ss" or "YYYY-MM-DD HH:mm:ss"
  return new Date(ts.replace(/\//g, "-"));
}

function glob(pattern) {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.match(pattern))
    .map((f) => path.join(DATA_DIR, f));
}

// Load checkins
const latestVisit = new Map();
for (const file of glob(/^checkins_.*\.csv$/)) {
  const rows = parseCSV(fs.readFileSync(file, "utf8"));
  for (const row of rows) {
    const ts = parseTimestamp(row.timestamp);
    if (isNaN(ts) || ts < CUTOFF) continue;
    const memberId = row.member_id;
    if (!latestVisit.has(memberId) || ts > latestVisit.get(memberId).ts) {
      latestVisit.set(memberId, { ts, raw: row.timestamp });
    }
  }
}

// Load members: member_id -> { email, name, affiliation }
const memberInfo = new Map();
for (const file of glob(/^members_.*\.csv$/)) {
  const rows = parseCSV(fs.readFileSync(file, "utf8"));
  for (const row of rows) {
    if (row.member_id && row.email) {
      memberInfo.set(row.member_id, { email: row.email, name: row.name || "", affiliation: row.affiliation || "", affiliation_detail: row.affiliation_detail || "" });
    }
  }
}

// Join: email をユニークキーにして最新 last_visit を保持
const byEmail = new Map();
for (const [memberId, { raw, ts }] of latestVisit) {
  const info = memberInfo.get(memberId);
  if (!info) continue;
  const { email, name, affiliation, affiliation_detail } = info;
  if (!byEmail.has(email) || ts > byEmail.get(email).ts) {
    byEmail.set(email, { email, name, affiliation, affiliation_detail, last_visit: raw, ts });
  }
}

const results = [...byEmail.values()];
results.sort((a, b) => b.ts - a.ts);

function csvField(v) {
  return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

// Output CSV
const header = "email,name,affiliation,affiliation_detail,last_visit";
const lines = results.map((r) => `${csvField(r.email)},${csvField(r.name)},${csvField(r.affiliation)},${csvField(r.affiliation_detail)},${r.last_visit}`);
const csv = [header, ...lines].join("\n") + "\n";

fs.writeFileSync(OUTPUT_FILE, csv, "utf8");
process.stdout.write(csv);
console.error(`\n${results.length} visitors written to ${OUTPUT_FILE}`);
