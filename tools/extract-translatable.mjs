import { ClassicLevel } from "/tmp/voidborne-tools/node_modules/classic-level/index.js";

const filter = process.argv[2] ?? "Classes";
const db = new ClassicLevel("packs/voidborne-items", { valueEncoding: "utf8" });
await db.open();

const folders = new Map();
const items = [];
for await (const [key, value] of db.iterator()) {
  const parsed = JSON.parse(value);
  if (key.startsWith("!folders!")) folders.set(parsed._id, parsed);
  if (key.startsWith("!items!")) items.push(parsed);
}
await db.close();

function folderPath(id) {
  const names = [];
  let current = folders.get(id);
  const seen = new Set();
  while (current && !seen.has(current._id)) {
    seen.add(current._id);
    names.unshift(current.name);
    current = current.folder ? folders.get(current.folder) : null;
  }
  return names.join(" / ");
}

for (const item of items
  .filter((item) => folderPath(item.folder).startsWith(filter))
  .sort((a, b) => folderPath(a.folder).localeCompare(folderPath(b.folder)) || a.name.localeCompare(b.name))) {
  const actions = Object.values(item.system?.actions ?? {}).map((action) => ({
    id: action._id,
    name: action.name,
    description: action.description,
  }));
  console.log(JSON.stringify({
    id: item._id,
    folder: folderPath(item.folder),
    type: item.type,
    name: item.name,
    description: item.system?.description ?? "",
    backgroundQuestions: item.system?.backgroundQuestions ?? [],
    connections: item.system?.connections ?? [],
    actions,
  }));
}
