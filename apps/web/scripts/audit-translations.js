const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/i18n.tsx"), "utf8");
const localeMatch = source.match(/LOCALES: DemoLocale\[\] = \[([^\]]+)\]/);
const locales = localeMatch[1].match(/"([^"]+)"/g).map((item) => item.replaceAll('"', ""));
const blocks = Object.fromEntries(
  [...source.matchAll(/"([a-z]{2}-[A-Z]{2})": \{([\s\S]*?)\n  \}/g)].map(([, locale, body]) => [
    locale,
    [...body.matchAll(/"([^"]+)":/g)].map(([, key]) => key).sort(),
  ]),
);
const canonical = blocks["en-US"];
let failed = false;

for (const locale of locales) {
  const keys = blocks[locale] ?? [];
  const missing = canonical.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !canonical.includes(key));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${locale}: missing=${missing.join(",") || "-"} extra=${extra.join(",") || "-"}`);
  }
}

if (source.includes("[VERIFY]")) {
  failed = true;
  console.error("Found [VERIFY] placeholders in translations.");
}

if (failed) process.exit(1);
console.log(`Translation audit passed for ${locales.length} locales and ${canonical.length} keys.`);
