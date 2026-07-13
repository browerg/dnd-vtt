export interface User {
  id: number;
  email: string;
  display_name: string;
  diceTheme?: string;
}

export interface CampaignSummary {
  id: number;
  name: string;
  description: string;
  system: string;
  role: string;
  member_count: number;
}

export interface Member {
  id: number;
  display_name: string;
  role: string;
}

export interface DieGroup {
  count: number;
  sides: number;
  results: number[];
  droppedResults?: number[];
}

export interface RollResult {
  groups: DieGroup[];
  modifier: number;
  total: number;
}

export interface RollDetail {
  mode: "normal" | "advantage" | "disadvantage" | "edge" | "setback";
  kept: RollResult;
  dropped?: RollResult;
  manual?: boolean; // physical dice at the table — total entered by hand
}

export interface RollPayload {
  id: number;
  campaignId: number;
  userId: number;
  userName: string;
  formula: string;
  label: string;
  mode: string;
  visibility: string;
  detail: RollDetail | null; // null = blind roll, result hidden from roller
  total: number | null;
  createdAt: string;
  diceTheme?: string; // roller's 3D dice colorset
}

export interface ChatMessage {
  id: number;
  campaignId: number;
  userId: number;
  userName: string;
  channel: "ic" | "ooc" | "whisper";
  targetUserId: number | null;
  targetName: string | null;
  speaker: string;
  body: string;
  createdAt: string;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

// Upload an inventory item photo; returns the stored image URL.
export async function uploadItemImage(campaignId: number, characterId: number, file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`/api/campaigns/${campaignId}/characters/${characterId}/item-image`, {
    method: "POST",
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Image upload failed");
  return (body as { url: string }).url;
}

// Upload a general image (e.g. a custom table backdrop); returns its URL.
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`/api/uploads/image`, { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Image upload failed");
  return (body as { url: string }).url;
}
