import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmporiumWelcome } from "./emporiumWelcome.js";

test("welcome adds 1000 once, preserves balance, and remembers dismissal", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE user_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER);
    CREATE TABLE vcoin_transactions (user_id INTEGER, amount INTEGER, reason TEXT, reference TEXT);
    INSERT INTO users VALUES (1), (2);
    INSERT INTO user_wallets VALUES (1, 275);`);
  const welcome = createEmporiumWelcome(db, 100);
  assert.equal(welcome.visit(1).needsIntroduction, true);
  welcome.visit(1);
  assert.equal((db.prepare("SELECT balance FROM user_wallets WHERE user_id = 1").get() as any).balance, 1275);
  welcome.acknowledge(1);
  assert.equal(welcome.visit(1).needsIntroduction, false);
  welcome.visit(2);
  assert.equal((db.prepare("SELECT balance FROM user_wallets WHERE user_id = 2").get() as any).balance, 1100);
  const restarted = createEmporiumWelcome(db, 100);
  assert.equal(restarted.visit(1).needsIntroduction, false);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM vcoin_transactions").get() as any).n, 2);
  db.close();
});
