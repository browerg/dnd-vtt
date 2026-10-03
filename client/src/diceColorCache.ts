// dice-box-threejs rewrites its built-in colorset definitions the first time
// any DiceBox loads one: the texture *name* ("fire", "astral"…) is replaced by
// the loaded texture object. Those definitions are module-level, so the next
// DiceBox that loads the same set reads the rewritten value, can't resolve it
// as a texture name, and silently falls back to no texture — e.g. Fire dice
// render flat orange in whichever box loaded the set second.
//
// Each DiceBox caches loaded sets in `DiceColors.colorsets`, and the first
// box's entries are the correct, fully textured ones. Pointing every DiceBox
// at one shared cache means later boxes reuse those instead of re-reading the
// broken definitions. Custom sets are cached by a name that encodes every
// setting (see diceBoxAppearanceConfig), so sharing can't mix two designs.
const sharedColorsets: Record<string, unknown> = {};

/** Call right after `new DiceBox(...)`, before `initialize()`. */
export function shareDiceColorsets<T>(box: T): T {
  const colors = (box as { DiceColors?: { colorsets?: Record<string, unknown> } }).DiceColors;
  if (colors) colors.colorsets = sharedColorsets;
  return box;
}
