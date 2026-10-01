// 프로젝트(워크스페이스)를 하나 추가한다. 추가 후 /review/<id> 에서 바로 열린다.
//
//   npm run project:add yumis 유미스      # .env.local 있으면 그 DB, 없으면 data/local.db
//
// POST /api/projects는 id를 nanoid로 자체 생성하므로 읽기 좋은 id를 지정할 수 없다.
// 그래서 행을 직접 넣는 경로를 따로 둔다. 같은 id가 이미 있으면 건너뛴다(멱등).

import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const [id, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();

if (!id || !name) {
  console.error("사용법: npm run project:add <id> <이름>");
  console.error("   예: npm run project:add yumis 유미스");
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL || "file:data/local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log(`[project:add] target: ${url}`);

if (url.startsWith("file:")) {
  const dir = path.dirname(path.resolve(url.slice("file:".length)));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const client = createClient({ url, authToken });

const existing = await client.execute({
  sql: "SELECT id, name FROM projects WHERE id = ?",
  args: [id],
});

if (existing.rows.length > 0) {
  console.log(`[project:add] 이미 존재: ${id} (${existing.rows[0].name}) — 건너뜀`);
} else {
  // created_at은 drizzle의 mode:"timestamp" = 초 단위.
  // Date.now()(밀리초)를 넣으면 생성일이 1970년으로 박힌다.
  await client.execute({
    sql: "INSERT INTO projects (id, name, created_at) VALUES (?, ?, strftime('%s','now'))",
    args: [id, name],
  });
  console.log(`[project:add] 생성: ${id} (${name})`);
}

const all = await client.execute(
  "SELECT id, name, datetime(created_at,'unixepoch') AS created FROM projects ORDER BY created_at"
);
console.log("[project:add] 현재 프로젝트 목록:");
for (const r of all.rows) {
  console.log(`  ${r.id}  ${r.name}  (${r.created})  → /review/${r.id}`);
}

client.close();
