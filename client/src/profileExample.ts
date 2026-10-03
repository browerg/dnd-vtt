import { DEFAULT_PROFILE_GALLERY } from "../../shared/profileGallery";
import type { GalleryData } from "./components/ProfileGallery";

// The approved Personal Gallery comp, as a labelled example profile. Every
// word and picture here is illustrative: Ruby Rose is not an account, and her
// badges are not achievements anyone earned. Real profiles render their own
// saved content through the same layout.
const art = (name: string) => `/assets/profile-gallery/example/${name}.webp`;

export const EXAMPLE_PROFILE: GalleryData = {
  profile: {
    id: 0,
    display_name: "Ruby Rose",
    pronouns: "she/her",
    bio: "Collector of stories. Terrible at stealth.",
    avatarPath: art("portrait"),
    diceTheme: "",
    profileGallery: {
      ...DEFAULT_PROFILE_GALLERY,
      characterName: "Rowan",
      memoryCaption: "That night by the lake, when everything finally felt like it might be okay.",
    },
  },
  art: {
    banner: art("banner"),
    character: art("character"),
    dice: art("dice"),
    memory: art("memory"),
  },
  showcase: [
    { id: "example-story", name: "Story Keeper", description: "Brings the lore to life", badgeImage: art("badge-story"), badgeThumbnail: art("badge-story"), badgeThumbnail2x: art("badge-story") },
    { id: "example-party", name: "Party Heart", description: "Looks out for everyone", badgeImage: art("badge-party"), badgeThumbnail: art("badge-party"), badgeThumbnail2x: art("badge-party") },
    { id: "example-solver", name: "Problem Solver", description: "Finds a way (usually)", badgeImage: art("badge-solver"), badgeThumbnail: art("badge-solver"), badgeThumbnail2x: art("badge-solver") },
  ],
  characters: [
    { id: 0, name: "Rowan", campaignId: 0, campaignName: "The Lakeside Oath", portraitUrl: art("character"), summary: "Wood elf ranger · level 6" },
  ],
  campaigns: [
    { id: 0, name: "The Lakeside Oath", system: "dnd5e", role: "player" },
  ],
};
