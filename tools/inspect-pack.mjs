import { ClassicLevel } from "/tmp/voidborne-tools/node_modules/classic-level/index.js";

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
  .map((item) => ({
    id: item._id,
    name: item.name,
    type: item.type,
    folder: folderPath(item.folder),
  }))
  .sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name))) {
  console.log(`${item.folder}\t${item.type}\t${item.name}\t${item.id}`);
}
