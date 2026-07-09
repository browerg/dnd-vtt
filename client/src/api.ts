export interface User {
  id: number;
  email: string;
  display_name: string;
}

export interface CampaignSummary {
  id: number;
  name: string;
  description: string;
  role: string;
  member_count: number;
}

export interface Member {
  id: number;
  display_name: string;
  role: string;
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
