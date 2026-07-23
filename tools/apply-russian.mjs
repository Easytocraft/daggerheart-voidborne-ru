import { ClassicLevel } from "/tmp/voidborne-tools/node_modules/classic-level/index.js";
import { effectTranslations, folderTranslations, itemTranslations } from "./ru-translations.mjs";

const SOURCE_MODULE_ID = "daggerheart-voidborne";
const TARGET_MODULE_ID = "daggerheart-voidborne-ru";
const itemPackPath = "packs/voidborne-items";
const packPaths = [itemPackPath, "packs/voidborne-actors", "packs/voidborne-macros"];
const translatedRootFolderIds = new Set([
  "lXmxaodRxdU6RGgH",
  "OsCwbT7RXOK0lIgt",
  "SXD38oqjOsJnqlYh",
  "rKeDNc40EFS5TWya",
]);

async function readEntries(path) {
  const db = new ClassicLevel(path, { valueEncoding: "utf8" });
  await db.open();
  const entries = [];
  for await (const [key, value] of db.iterator()) entries.push([String(key), value]);
  return { db, entries };
}

const itemPack = await readEntries(itemPackPath);
const folders = new Map();
const items = new Map();
for (const [key, value] of itemPack.entries) {
  const document = JSON.parse(value);
  if (key.startsWith("!folders!")) folders.set(document._id, document);
  else if (/^!items![^.]+$/.test(key)) items.set(document._id, document);
}

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

function belongsToTranslatedRoot(id) {
  let current = folders.get(id);
  const seen = new Set();
  while (current && !seen.has(current._id)) {
    if (translatedRootFolderIds.has(current._id)) return true;
    seen.add(current._id);
    current = current.folder ? folders.get(current.folder) : null;
  }
  return false;
}

const translatedItems = [...items.values()].filter((item) => belongsToTranslatedRoot(item.folder));
const translatedItemIds = new Set(translatedItems.map((item) => item._id));
const missingItems = translatedItems.filter((item) => !itemTranslations[item._id]);
const translatedEffects = itemPack.entries.filter(([key]) => {
  const match = key.match(/^!items\.effects!([^.]+)\./);
  return match && translatedItemIds.has(match[1]);
});
const missingEffects = translatedEffects.filter(([key]) => !effectTranslations[key]);

if (missingItems.length || missingEffects.length) {
  if (missingItems.length) console.error("Missing item translations:", missingItems.map((item) => `${item.name} (${item._id})`));
  if (missingEffects.length) console.error("Missing effect translations:", missingEffects.map(([key]) => key));
  await itemPack.db.close();
  process.exitCode = 1;
} else {
  await itemPack.db.close();

  for (const path of packPaths) {
    const { db, entries } = await readEntries(path);
    const operations = [];

    for (const [key, originalValue] of entries) {
      let value = originalValue.replaceAll(SOURCE_MODULE_ID, TARGET_MODULE_ID);
      let document;
      try {
        document = JSON.parse(value);
      } catch {
        operations.push({ type: "put", key, value });
        continue;
      }

      if (path === itemPackPath && key.startsWith("!folders!")) {
        const translatedName = folderTranslations[document._id];
        if (translatedName) document.name = translatedName;
      }

      if (path === itemPackPath && /^!items![^.]+$/.test(key)) {
        const translation = itemTranslations[document._id];
        if (translation) {
          if (translation.name !== undefined) document.name = translation.name;
          if (translation.description !== undefined) document.system.description = translation.description;
          if (translation.backgroundQuestions !== undefined) document.system.backgroundQuestions = translation.backgroundQuestions;
          if (translation.connections !== undefined) document.system.connections = translation.connections;
          if (translation.attackName !== undefined && document.system?.attack) {
            document.system.attack.name = translation.attackName;
          }

          for (const [actionId, actionTranslation] of Object.entries(translation.actions ?? {})) {
            const action = document.system?.actions?.[actionId];
            if (!action) throw new Error(`Action ${actionId} is missing from ${document.name}`);
            if (actionTranslation.name !== undefined) action.name = actionTranslation.name;
            if (actionTranslation.description !== undefined) action.description = actionTranslation.description;
          }
        }
      }

      if (path === itemPackPath && key.startsWith("!items.effects!")) {
        const translation = effectTranslations[key];
        if (translation) {
          if (translation.name !== undefined) document.name = translation.name;
          if (translation.description !== undefined) document.description = translation.description;
          if (translation.durationDescription !== undefined) document.system.duration.description = translation.durationDescription;
        }
      }

      operations.push({ type: "put", key, value: JSON.stringify(document) });
    }

    await db.batch(operations);
    await db.compactRange("", "~");
    await db.close();
    console.log(`${path}: updated ${operations.length} records`);
  }

  console.log(`Translated ${translatedItems.length} player-facing items and ${translatedEffects.length} embedded effects.`);
}
