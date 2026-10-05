import { readFileSync } from "node:fs";
import path from "node:path";

// Posts to the Discord webhook the GM saved in the Vivid Realms launcher.
// The launcher starts this server on the same machine, so its settings file
// is right there; that way the webhook is configured in one place and the
// launcher's "Discord on/off" switch covers these posts too.
// VIVID_DISCORD_WEBHOOK_URL overrides it (for running without the launcher).

export type DiscordStatus = "ready" | "disabled" | "not-configured";

function launcherSettingsPath(): string | null {
  const appData = process.env.APPDATA;
  return appData ? path.join(appData, "vivid-realms-launcher", "launcher-settings.json") : null;
}

function isWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"].includes(url.hostname.toLowerCase()) &&
      /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[^/]+\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function discordWebhook(): { status: DiscordStatus; url?: string } {
  const override = String(process.env.VIVID_DISCORD_WEBHOOK_URL ?? "").trim();
  if (override) return isWebhookUrl(override) ? { status: "ready", url: override } : { status: "not-configured" };
  const file = launcherSettingsPath();
  if (!file) return { status: "not-configured" };
  try {
    const settings = JSON.parse(readFileSync(file, "utf8"));
    const url = String(settings?.discordWebhookUrl ?? "").trim();
    if (!url || !isWebhookUrl(url)) return { status: "not-configured" };
    if (settings?.discordEnabled !== true) return { status: "disabled" };
    return { status: "ready", url };
  } catch {
    return { status: "not-configured" };
  }
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

/** Resolves to the outcome; never throws, since Discord is a nicety. */
export async function postToDiscord(embed: DiscordEmbed): Promise<DiscordStatus | "failed" | "sent"> {
  const hook = discordWebhook();
  if (hook.status !== "ready" || !hook.url) return hook.status;
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "Vivid Realms",
        embeds: [embed],
        // Never ping anyone from text players typed.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
