import { ClassicLevel } from "/tmp/voidborne-tools/node_modules/classic-level/index.js";

const db = new ClassicLevel("packs/voidborne-items", { valueEncoding: "utf8" });
await db.open();

const folders = new Map();
const items = new Map();
const effects = [];
for await (const [key, value] of db.iterator()) {
  const parsed = JSON.parse(value);
  if (key.startsWith("!folders!")) folders.set(parsed._id, parsed);
  else if (key.startsWith("!items!")) items.set(parsed._id, parsed);
  else if (key.startsWith("!items.effects!")) {
    const [, parentId] = key.match(/^!items\.effects!([^.]+)\./) ?? [];
    effects.push({ key, parentId, effect: parsed });
  }
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

for (const entry of effects) {
  const parent = items.get(entry.parentId);
  if (!parent || !folderPath(parent.folder).startsWith("Classes")) continue;
  console.log(JSON.stringify({
    key: entry.key,
    parent: parent.name,
    name: entry.effect.name,
    description: entry.effect.description ?? "",
    durationDescription: entry.effect.system?.duration?.description ?? "",
  }));
}
