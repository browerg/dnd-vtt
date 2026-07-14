import type { KeyboardEvent } from "react";

// Matches an indented bullet line: leading whitespace, a marker, one space,
// then the rest of the line (up to the caret).
const BULLET = /^(\s*)([-*•])\s(.*)$/;

// Google-Docs-style list continuation for a plain <textarea>. Works for BOTH
// controlled and uncontrolled textareas: we edit the value via setRangeText
// (which also moves the caret) and then dispatch a native "input" event so a
// controlled component's React onChange fires and its state stays in sync.
export function handleBulletKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key !== "Enter" || e.shiftKey) return;
  const el = e.currentTarget;
  if (el.selectionStart !== el.selectionEnd) return; // ignore range selections
  const caret = el.selectionStart;
  const value = el.value;
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const line = value.slice(lineStart, caret);
  const m = BULLET.exec(line);
  if (!m) return; // not a bullet line — let Enter do its normal thing
  const [, indent, marker, rest] = m;
  e.preventDefault();
  if (rest.trim() === "") {
    // Empty bullet: remove the marker, leaving an empty line (exit the list).
    el.setRangeText("", lineStart, caret, "end");
  } else {
    // Continue: newline + same indentation + same marker + a space.
    el.setRangeText(`\n${indent}${marker} `, caret, caret, "end");
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
