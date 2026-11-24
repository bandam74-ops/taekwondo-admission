// data/*.json → js/data.js (정적 호스팅·로컬 file:// 모두에서 동작하도록 번들)
// 사용법: node scripts/build-data.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name, fallback) => {
  const p = join(root, "data", name);
  if (!existsSync(p)) { console.warn(`! ${name} 없음 — 빈 데이터로 진행`); return fallback; }
  return JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
};

const fouryear = read("fouryear.json", []);
const college = read("college.json", []);
const creditbank = read("creditbank.json", { overview: null, institutions: [] });

const all = [...fouryear, ...college, ...(creditbank.institutions || [])];
const ids = new Set();
const problems = [];
for (const s of all) {
  if (!s.id) problems.push(`id 없음: ${s.university}`);
  else if (ids.has(s.id)) problems.push(`중복 id: ${s.id}`);
  ids.add(s.id);
  for (const k of ["type", "university", "department", "region"]) if (!s[k]) problems.push(`${s.id}: ${k} 없음`);
  if (!Array.isArray(s.admissions)) s.admissions = [];
  for (const a of s.admissions) {
    // 모집시기 정규화: 수시/정시 외 표기(학기별, 연 4회 등)는 '상시'로 두고 원문은 period에 보존
    if (!/^(수시|정시)/.test(a.round || "")) { if (a.round && a.round !== "상시") a.period = a.round; a.round = "상시"; }
    else a.round = a.round.startsWith("수시") ? "수시" : "정시";
    if (a.category === "면접") a.category = "면접위주";
    if (/^서류(\(|$)/.test(a.category || "")) a.category = "서류";
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

const builtAt = new Date().toISOString().slice(0, 10);
const out = `/* 자동 생성 파일 — 직접 수정하지 말고 data/*.json 수정 후 node scripts/build-data.mjs 실행 */\nwindow.TKD_DATA = ${JSON.stringify({ builtAt, fouryear, college, creditbank })};\n`;
writeFileSync(join(root, "js", "data.js"), out, "utf8");
console.log(`OK  4년제 ${fouryear.length} · 전문대 ${college.length} · 학점은행 ${(creditbank.institutions || []).length} → js/data.js`);
