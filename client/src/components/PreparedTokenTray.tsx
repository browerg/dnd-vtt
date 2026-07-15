import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";

export interface MonsterPreparation {
  id: number;
  name: string;
  hp: number;
  size: string;
}

interface PreparedToken {
  id: number;
  campaignId: number;
  monsterId: number | null;
  name: string;
  color: string;
  size: number;
  hp: number;
  maxHp: number;
  imageUrl: string;
  imageScale: number;
  conditions: string[];
}

interface EncounterGroup {
  id: number;
  campaignId: number;
  name: string;
  members: {
    id: number;
    name: string;
    imageUrl: string;
    color: string;
    size: number;
    offsetX: number;
    offsetY: number;
  }[];
}

interface Props {
  campaignId: number;
  mapId: number;
  monster: MonsterPreparation | null;
  onCloseMonster: () => void;
}

const sizeFromMonster = (size: string) =>
  ({ tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 } as Record<string, number>)[
    String(size || "medium").toLowerCase()
  ] ?? 1;

export default function PreparedTokenTray({ campaignId, mapId, monster, onCloseMonster }: Props) {
  const [tokens, setTokens] = useState<PreparedToken[]>([]);
  const [groups, setGroups] = useState<EncounterGroup[]>([]);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<number>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [groupBusy, setGroupBusy] = useState<number | "create" | null>(null);
  const [busy, setBusy] = useState<number | "prepare" | null>(null);
  const [editing, setEditing] = useState<PreparedToken | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [tokenResult, groupResult] = await Promise.all([
        api<{ preparedTokens: PreparedToken[] }>(
          `/api/campaigns/${campaignId}/prepared-tokens`
        ),
        api<{ groups: EncounterGroup[] }>(
          `/api/campaigns/${campaignId}/prepared-encounters`
        ),
      ]);
      setTokens(tokenResult.preparedTokens);
      setGroups(groupResult.groups);
      setSelectedForGroup((previous) => {
        const validIds = new Set(tokenResult.preparedTokens.map((token) => token.id));
        return new Set([...previous].filter((id) => validIds.has(id)));
      });
    } catch (e: any) {
      setError(e.message);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("prepared-tokens:refresh", refresh);
    return () => window.removeEventListener("prepared-tokens:refresh", refresh);
  }, [load]);

  const createEncounterGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedForGroup.size < 2) {
      setError("Choose at least two prepared tokens for the encounter.");
      return;
    }
    setGroupBusy("create");
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/prepared-encounters`, {
        method: "POST",
        body: JSON.stringify({
          name: groupName,
          tokenIds: [...selectedForGroup],
        }),
      });
      setGroupName("");
      setSelectedForGroup(new Set());
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGroupBusy(null);
    }
  };

  const deployEncounterGroup = async (group: EncounterGroup) => {
    setGroupBusy(group.id);
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/prepared-encounters/${group.id}/deploy`, {
        method: "POST",
        body: JSON.stringify({ mapId }),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGroupBusy(null);
    }
  };

  const deleteEncounterGroup = async (group: EncounterGroup) => {
    if (!confirm(`Delete encounter group "${group.name}"? The prepared tokens will stay in the tray.`)) return;
    await api(`/api/campaigns/${campaignId}/prepared-encounters/${group.id}`, {
      method: "DELETE",
    });
    await load();
  };

  const prepare = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!monster) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("monsterId", String(monster.id));
    setBusy("prepare");
    setError("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/prepared-tokens`, {
        method: "POST",
        body: data,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not prepare token.");
      await load();
      onCloseMonster();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const deploy = async (token: PreparedToken) => {
    setBusy(token.id);
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/prepared-tokens/${token.id}/deploy`, {
        method: "POST",
        body: JSON.stringify({ mapId }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (token: PreparedToken) => {
    if (!confirm(`Permanently delete prepared token "${token.name}"?`)) return;
    await api(`/api/campaigns/${campaignId}/prepared-tokens/${token.id}`, { method: "DELETE" });
    await load();
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    await api(`/api/campaigns/${campaignId}/prepared-tokens/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: data.get("name"),
        size: Number(data.get("size")),
        hp: Number(data.get("hp")),
        maxHp: Number(data.get("maxHp")),
        color: data.get("color"),
        imageScale: Number(data.get("imageScale")),
      }),
    });
    setEditing(null);
    await load();
  };

  return (
    <>
      <section className="prepared-token-section">
        <div className="row-between">
          <h4>Prepared Tokens</h4>
          <button className="ghost mini" onClick={() => void load()} title="Refresh tray">↻</button>
        </div>
        {error && <p className="error small">{error}</p>}
        {groups.length > 0 && (
          <div className="prepared-encounter-groups">
            {groups.map((group) => (
              <article className="prepared-encounter-card" key={group.id}>
                <div>
                  <strong>{group.name}</strong>
                  <small>{group.members.length} reusable tokens</small>
                </div>
                <div className="prepared-encounter-thumbs">
                  {group.members.slice(0, 6).map((member) =>
                    member.imageUrl ? (
                      <img key={member.id} src={member.imageUrl} alt="" />
                    ) : (
                      <span key={member.id} style={{ background: member.color }} />
                    )
                  )}
                </div>
                <div className="prepared-token-actions">
                  <button
                    disabled={groupBusy === group.id || group.members.length === 0}
                    onClick={() => deployEncounterGroup(group)}
                  >
                    {groupBusy === group.id ? "Deploying..." : "Deploy group"}
                  </button>
                  <button className="danger mini" onClick={() => deleteEncounterGroup(group)}>
                    Delete group
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tokens.length >= 2 && (
          <form className="prepared-encounter-builder" onSubmit={createEncounterGroup}>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Encounter name, e.g. Beowolf Ambush"
              required
            />
            <button disabled={groupBusy === "create" || selectedForGroup.size < 2}>
              {groupBusy === "create"
                ? "Saving..."
                : `Save selected as group (${selectedForGroup.size})`}
            </button>
          </form>
        )}

        {tokens.length === 0 && <p className="muted small">No unused encounter tokens.</p>}
        <div className="prepared-token-list">
          {tokens.map((token) => (
            <article
              className="prepared-token-card"
              key={token.id}
              draggable={busy !== token.id}
              title="Drag onto the map for exact placement"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                  "application/x-prepared-token",
                  JSON.stringify({
                    id: token.id,
                    name: token.name,
                    size: token.size,
                    imageUrl: token.imageUrl,
                    color: token.color,
                  })
                );
                event.dataTransfer.setData("text/plain", token.name);
                event.currentTarget.classList.add("is-dragging");
              }}
              onDragEnd={(event) => event.currentTarget.classList.remove("is-dragging")}
            >
              <label
                className="prepared-token-group-picker"
                title="Select this token for an encounter group"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedForGroup.has(token.id)}
                  onChange={(event) => {
                    setSelectedForGroup((previous) => {
                      const next = new Set(previous);
                      if (event.target.checked) next.add(token.id);
                      else next.delete(token.id);
                      return next;
                    });
                  }}
                />
                Group
              </label>
              <div className="prepared-token-summary">
                {token.imageUrl ? (
                  <img src={token.imageUrl} alt="" />
                ) : (
                  <span className="prepared-token-swatch" style={{ background: token.color }} />
                )}
                <span>
                  <strong>{token.name}</strong>
                  <small>{token.size}×{token.size} · HP {token.hp}/{token.maxHp}</small>
                </span>
              </div>
              <div className="prepared-token-actions">
                <button disabled={busy === token.id} onClick={() => deploy(token)}>
                  {busy === token.id ? "Deploying..." : "Deploy center"}
                </button>
                <span className="prepared-token-drag-hint">⋮⋮ Drag to map</span>
                <button className="ghost mini" onClick={() => setEditing(token)}>Edit</button>
                <button className="danger mini" onClick={() => remove(token)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {monster && createPortal(
        <div className="prepared-token-backdrop" onClick={onCloseMonster}>
          <form className="prepared-token-modal stack" onSubmit={prepare} onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <div>
                <span className="prepared-token-kicker">Monster preparation</span>
                <h2>Prepare {monster.name}</h2>
              </div>
              <button type="button" className="ghost mini" onClick={onCloseMonster}>×</button>
            </div>
            <label>
              Token name
              <input name="name" defaultValue={monster.name} required />
            </label>
            <div className="prepared-token-grid">
              <label>
                Size
                <select name="size" defaultValue={sizeFromMonster(monster.size)}>
                  <option value="1">1 × 1</option>
                  <option value="2">2 × 2</option>
                  <option value="3">3 × 3</option>
                  <option value="4">4 × 4</option>
                </select>
              </label>
              <label>
                Quantity
                <input name="quantity" type="number" min="1" max="20" defaultValue="1" />
              </label>
              <label>
                Current HP
                <input name="hp" type="number" min="0" defaultValue={monster.hp || 10} />
              </label>
              <label>
                Maximum HP
                <input name="maxHp" type="number" min="1" defaultValue={monster.hp || 10} />
              </label>
              <label>
                Fallback color
                <input name="color" type="color" defaultValue="#a03636" />
              </label>
              <label>
                Artwork scale
                <input name="imageScale" type="number" min=".5" max="2.5" step=".05" defaultValue="1" />
              </label>
            </div>
            <label>
              PNG, JPG, or WebP artwork
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
            <p className="muted small">
              This saves the monster off-map. Deploy it from the right sidebar when the encounter begins.
            </p>
            {error && <div className="error">{error}</div>}
            <button disabled={busy === "prepare"}>
              {busy === "prepare" ? "Preparing..." : "Save to Prepared Tokens"}
            </button>
          </form>
        </div>,
        document.body
      )}

      {editing && createPortal(
        <div className="prepared-token-backdrop" onClick={() => setEditing(null)}>
          <form className="prepared-token-modal stack" onSubmit={saveEdit} onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h2>Edit prepared token</h2>
              <button type="button" className="ghost mini" onClick={() => setEditing(null)}>×</button>
            </div>
            <label>Name<input name="name" defaultValue={editing.name} required /></label>
            <div className="prepared-token-grid">
              <label>Size<input name="size" type="number" min="1" max="4" defaultValue={editing.size} /></label>
              <label>HP<input name="hp" type="number" min="0" defaultValue={editing.hp} /></label>
              <label>Max HP<input name="maxHp" type="number" min="1" defaultValue={editing.maxHp} /></label>
              <label>Color<input name="color" type="color" defaultValue={editing.color} /></label>
              <label>Artwork scale<input name="imageScale" type="number" min=".5" max="2.5" step=".05" defaultValue={editing.imageScale} /></label>
            </div>
            <button>Save changes</button>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}
