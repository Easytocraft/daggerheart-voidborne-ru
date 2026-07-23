import fs from "node:fs";
import { ClassicLevel } from "/tmp/voidborne-tools/node_modules/classic-level/index.js";
import { effectTranslations, folderTranslations, itemTranslations } from "./ru-translations.mjs";

const failures = [];
const moduleData = JSON.parse(fs.readFileSync("module.json", "utf8"));
if (moduleData.id !== "daggerheart-voidborne-ru") failures.push("Wrong module id");

const db = new ClassicLevel("packs/voidborne-items", { valueEncoding: "json" });
await db.open();
const documents = new Map();
const rawValues = [];
for await (const [key, value] of db.iterator()) {
  documents.set(String(key), value);
  rawValues.push(JSON.stringify(value));
}
await db.close();

for (const [id, expectedName] of Object.entries(folderTranslations)) {
  const document = documents.get(`!folders!${id}`);
  if (!document) failures.push(`Missing folder ${id}`);
  else if (document.name !== expectedName) failures.push(`Folder ${id} was not translated`);
}

for (const [id, translation] of Object.entries(itemTranslations)) {
  const document = documents.get(`!items!${id}`);
  if (!document) {
    failures.push(`Missing item ${id}`);
    continue;
  }
  if (translation.name !== undefined && document.name !== translation.name) failures.push(`Wrong name for item ${id}`);
  if (translation.description !== undefined && document.system.description !== translation.description) failures.push(`Wrong description for item ${id}`);
  if (translation.backgroundQuestions !== undefined && JSON.stringify(document.system.backgroundQuestions) !== JSON.stringify(translation.backgroundQuestions)) failures.push(`Wrong background questions for item ${id}`);
  if (translation.connections !== undefined && JSON.stringify(document.system.connections) !== JSON.stringify(translation.connections)) failures.push(`Wrong connections for item ${id}`);
  if (translation.attackName !== undefined && document.system?.attack?.name !== translation.attackName) failures.push(`Wrong attack name for item ${id}`);

  for (const [actionId, actionTranslation] of Object.entries(translation.actions ?? {})) {
    const action = document.system?.actions?.[actionId];
    if (!action) failures.push(`Missing action ${actionId} in item ${id}`);
    else {
      if (actionTranslation.name !== undefined && action.name !== actionTranslation.name) failures.push(`Wrong action name ${actionId}`);
      if (actionTranslation.description !== undefined && action.description !== actionTranslation.description) failures.push(`Wrong action description ${actionId}`);
    }
  }
}

for (const [key, translation] of Object.entries(effectTranslations)) {
  const document = documents.get(key);
  if (!document) {
    failures.push(`Missing effect ${key}`);
    continue;
  }
  if (translation.name !== undefined && document.name !== translation.name) failures.push(`Wrong effect name ${key}`);
  if (translation.description !== undefined && document.description !== translation.description) failures.push(`Wrong effect description ${key}`);
  if (translation.durationDescription !== undefined && document.system.duration.description !== translation.durationDescription) failures.push(`Wrong effect duration ${key}`);
}

const itemIds = new Set([...documents.keys()].filter((key) => /^!items![^.]+$/.test(key)).map((key) => key.slice("!items!".length)));
for (const value of rawValues) {
  for (const match of value.matchAll(/Compendium\.daggerheart-voidborne-ru\.voidborne-items\.Item\.([A-Za-z0-9]+)/g)) {
    if (!itemIds.has(match[1])) failures.push(`Broken compendium link to item ${match[1]}`);
  }
  if (/daggerheart-voidborne(?!-ru)/.test(value)) failures.push("Stale original module reference");
}

const classDocs = [...documents.entries()]
  .filter(([key, value]) => /^!items![^.]+$/.test(key) && ["class", "subclass"].includes(value.type))
  .map(([, value]) => value);
if (classDocs.length !== 19) failures.push(`Expected 19 class/subclass documents, got ${classDocs.length}`);
for (const document of classDocs) {
  if (!document.system.description) failures.push(`Empty description for ${document.name}`);
}

const ancestryDocs = [...documents.values()].filter((value) => value.type === "ancestry");
const communityDocs = [...documents.values()].filter((value) => value.type === "community");
const domainCardDocs = [...documents.values()].filter((value) => value.type === "domainCard");
if (ancestryDocs.length !== 6) failures.push(`Expected 6 ancestry documents, got ${ancestryDocs.length}`);
if (communityDocs.length !== 6) failures.push(`Expected 6 community documents, got ${communityDocs.length}`);
if (domainCardDocs.length !== 42) failures.push(`Expected 42 domain cards, got ${domainCardDocs.length}`);

const englishWords = /\b(?:the|you|your|when|while|with|within|and|or|can|may|must|make|mark|spend|gain|take|deal|target|attack|damage|roll|stress|hope|range|once|per|until|after|before|against|this|that|each|have|has|are|is|from|instead|spellcast|hit points?)\b/i;
const stripMarkup = (value) => String(value ?? "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\[\[[^\]]+\]\]/g, " ")
  .replace(/&\w+;/g, " ");

for (const id of Object.keys(itemTranslations)) {
  const document = documents.get(`!items!${id}`);
  if (!document) continue;
  const visibleStrings = [
    document.name,
    document.system?.description,
    ...(document.system?.backgroundQuestions ?? []),
    ...(document.system?.connections ?? []),
    ...Object.values(document.system?.actions ?? {}).flatMap((action) => [action.name, action.description]),
    document.system?.attack?.name,
  ];
  for (const value of visibleStrings) {
    if (value && englishWords.test(stripMarkup(value))) {
      failures.push(`English player-facing text remains in ${document.name}: ${stripMarkup(value).trim().slice(0, 100)}`);
    }
  }
}

for (const [key] of Object.entries(effectTranslations)) {
  const document = documents.get(key);
  if (!document) continue;
  for (const value of [document.name, document.description, document.system?.duration?.description]) {
    if (value && englishWords.test(stripMarkup(value))) {
      failures.push(`English effect text remains in ${key}: ${stripMarkup(value).trim().slice(0, 100)}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validation passed: ${Object.keys(itemTranslations).length} items, ${Object.keys(effectTranslations).length} effects, ${classDocs.length} classes and subclasses, ${ancestryDocs.length} ancestries, ${communityDocs.length} communities, ${domainCardDocs.length} domain cards.`);
}
