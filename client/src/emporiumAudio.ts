// Room tone, door and till for The Emporium.
//
//   Music — ebunny, "Medieval Castle Loop" (Pixabay 366828)
//   Door  — dragon-studio, "Opening Door" (Pixabay 450444)
//   Coins — alexzavesa, "Clinking Coins 7" (Pixabay 468427)

import { createAudioSample } from "./audioSample";
import { createMusicLoop } from "./musicLoop";

export const EMPORIUM_MUSIC_KEY = "emporium-music";

// Everything here sits at the same level as the rest of the table's audio.
const EMPORIUM_VOLUME = 0.08;

export const emporiumMusic = createMusicLoop("/assets/audio/emporium-loop.mp3", EMPORIUM_VOLUME);

/** The shop door, on the way in. */
export const emporiumDoor = createAudioSample("/assets/audio/emporium-door.mp3", EMPORIUM_VOLUME);

// Two purchases in the same instant should chink once, not twice.
const coin = createAudioSample("/assets/audio/coin-purchase.mp3", EMPORIUM_VOLUME, 120);

export const primeCoinSound = coin.prime;

/** A handful of coins changing hands. Silent when the table is muted. */
export const playCoinSound = coin.play;
