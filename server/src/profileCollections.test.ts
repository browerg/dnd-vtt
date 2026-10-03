import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { profileCollections } from "./profileCollections.js";

test("profile collections isolate shared campaigns, exclude NPCs and former memberships, and omit private sheet fields", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE campaigns(id INTEGER, name TEXT, system TEXT);
      CREATE TABLE campaign_members(campaign_id INTEGER,user_id INTEGER,role TEXT);
      CREATE TABLE characters(id INTEGER,name TEXT,campaign_id INTEGER,user_id INTEGER,is_npc INTEGER,portrait_path TEXT,data TEXT,updated_at TEXT);
      INSERT INTO campaigns VALUES(1,'Shared','dnd5e'),(2,'Private','remnant'),(3,'Former','dnd5e');
      INSERT INTO campaign_members VALUES(1,1,'player'),(1,2,'player'),(2,1,'player'),(3,2,'player');
      INSERT INTO characters VALUES(1,'Visible',1,1,0,'portrait.webp','{"class":"Ranger","secret":"hidden"}','2026'),
       (2,'Private',2,1,0,'','{}','2026'),(3,'NPC',1,1,1,'','{}','2026'),(4,'Former',3,1,0,'','{}','2026');`);
    const visitor = profileCollections(db, 1, 2);
    assert.deepEqual(visitor.characters.map(c => c.name), ["Visible"]);
    assert.deepEqual(visitor.campaigns.map(c => c.name), ["Shared"]);
    assert.equal(visitor.characters[0].summary, "Ranger");
    assert.ok(!JSON.stringify(visitor).includes("hidden"));
    assert.equal(profileCollections(db, 1, 1).characters.length, 2);
    assert.deepEqual(profileCollections(db, 1, 99), { characters: [], campaigns: [] });
    db.exec("UPDATE characters SET data = 'invalid' WHERE id = 1");
    assert.equal(profileCollections(db, 1, 2).characters[0].summary, "");
  } finally { db.close(); }
});
