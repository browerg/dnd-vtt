import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../App";
import { api } from "../api";
import CampaignThemeBrand from "../components/CampaignThemeBrand";
import { useCampaignTheme } from "../theme";
import "./SchedulePage.css";

type Status = "yes" | "maybe" | "no";
type DiscordStatus = "ready" | "disabled" | "not-configured";
interface Member { userId: number; role: string; name: string }
interface Mark { userId: number; day: string; status: Status }

const DAYS_SHOWN = 14;
const NEXT: Record<string, Status | null> = { "": "yes", yes: "maybe", maybe: "no", no: null };
const MARK_LABEL: Record<Status, string> = { yes: "Free", maybe: "Maybe", no: "Busy" };
const SCORE: Record<Status, number> = { yes: 2, maybe: 1, no: -4 };

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const DISCORD_NOTE: Record<string, string> = {
  sent: "Posted to Discord.",
  disabled: "Saved. Discord is switched off in the launcher, so nothing was posted. Turn it on under the launcher's Discord settings.",
  "not-configured": "Saved. No Discord webhook is set up in the launcher, so nothing was posted.",
  failed: "Saved, but Discord didn't accept the post. Check the webhook in the launcher.",
};

export default function SchedulePage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { user } = useAuth();
  const [role, setRole] = useState("");
  const [system, setSystem] = useState("dnd5e");
  const [campaignTheme, setCampaignTheme] = useState("");
  const [campaignName, setCampaignName] = useState("Campaign");
  const [chapter, setChapter] = useState("");
  const [sessionNumber, setSessionNumber] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [nextSessionAt, setNextSessionAt] = useState<string | null>(null);
  const [discord, setDiscord] = useState<DiscordStatus | undefined>();
  const [lockDay, setLockDay] = useState<string | null>(null);
  const [lockTime, setLockTime] = useState("19:00");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const themeView = useCampaignTheme({ campaignId, userId: user?.id, system, campaignTheme });
  const isDM = role === "dm" || role === "co-dm";

  const days = useMemo(() => {
    const start = new Date();
    return Array.from({ length: DAYS_SHOWN }, (_, i) => isoDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }, []);

  useEffect(() => {
    api<{ yourRole: string; campaign: { system: string; theme: string; name: string; chapter: string; session_number: number } }>(`/api/campaigns/${campaignId}`)
      .then((r) => {
        setRole(r.yourRole);
        setSystem(r.campaign.system);
        setCampaignTheme(r.campaign.theme ?? "");
        setCampaignName(r.campaign.name);
        setChapter(r.campaign.chapter ?? "");
        setSessionNumber(r.campaign.session_number ?? 0);
      })
      .catch((e) => setError(e.message));
  }, [campaignId]);

  const load = useCallback(() => {
    api<{ members: Member[]; availability: Mark[]; nextSessionAt: string | null; discord?: DiscordStatus }>(
      `/api/campaigns/${campaignId}/schedule?from=${days[0]}`
    )
      .then((r) => {
        setMembers(r.members);
        setMarks(r.availability);
        setNextSessionAt(r.nextSessionAt);
        setDiscord(r.discord);
      })
      .catch((e) => setError(e.message));
  }, [campaignId, days]);

  useEffect(() => {
    load();
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("schedule:update", (m: { campaignId: number }) => m.campaignId === campaignId && load());
    return () => {
      socket.disconnect();
    };
  }, [campaignId, load]);

  const markOf = (userId: number, day: string): Status | "" =>
    marks.find((m) => m.userId === userId && m.day === day)?.status ?? "";

  const cycle = async (day: string) => {
    if (!user) return;
    const next = NEXT[markOf(user.id, day)];
    // Optimistic: the grid answers instantly, the socket echo confirms.
    setMarks((all) => [
      ...all.filter((m) => !(m.userId === user.id && m.day === day)),
      ...(next ? [{ userId: user.id, day, status: next }] : []),
    ]);
    try {
      await api(`/api/campaigns/${campaignId}/schedule/availability`, {
        method: "PUT",
        body: JSON.stringify({ day, status: next }),
      });
    } catch (e: any) {
      setError(e.message);
      load();
    }
  };

  const dayStats = (day: string) => {
    const statuses = members.map((m) => markOf(m.userId, day));
    return {
      free: statuses.filter((s) => s === "yes").length,
      maybe: statuses.filter((s) => s === "maybe").length,
      busy: statuses.filter((s) => s === "no").length,
      score: statuses.reduce((sum, s) => sum + (s ? SCORE[s] : 0), 0),
      everyone: members.length > 0 && statuses.every((s) => s === "yes"),
    };
  };

  const bestDays = days
    .map((day) => ({ day, ...dayStats(day) }))
    .filter((d) => d.free > 0 && d.busy === 0)
    .sort((a, b) => b.score - a.score || a.day.localeCompare(b.day))
    .slice(0, 3);

  const lockIn = async () => {
    if (!lockDay) return;
    const [h, m] = lockTime.split(":").map(Number);
    const at = fromIso(lockDay);
    at.setHours(h || 0, m || 0, 0, 0);
    setBusy(true);
    setError("");
    try {
      const r = await api<{ discord: string }>(`/api/campaigns/${campaignId}/schedule/lock`, {
        method: "POST",
        body: JSON.stringify({ at: at.toISOString(), day: lockDay }),
      });
      setNotice(DISCORD_NOTE[r.discord] ?? "Saved.");
      setLockDay(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const askDiscord = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ discord: string }>(`/api/campaigns/${campaignId}/schedule/ask`, { method: "POST" });
      setNotice(r.discord === "sent" ? "Asked the group on Discord." : DISCORD_NOTE[r.discord]?.replace(/^Saved\. ?/, "") ?? "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const clearLock = async () => {
    await api(`/api/campaigns/${campaignId}/schedule/lock`, { method: "DELETE" }).catch(() => {});
    setNotice("");
    load();
  };

  const next = nextSessionAt ? new Date(nextSessionAt) : null;
  const nextInPast = next ? next.getTime() < Date.now() - 6 * 3600_000 : false;
  const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) => fromIso(day).toLocaleDateString(undefined, opts);

  return (
    <div className="shell campaign-themed" data-system={system} data-theme={themeView.themeId}>
      <header className="topbar campaign-topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-back-link">{"←"}</Link>
        <CampaignThemeBrand campaignName={campaignName} chapter={chapter} sessionNumber={sessionNumber} themeId={themeView.themeId} pageLabel="Schedule" />
        <span className="current-page-indicator" aria-current="page">
          <span className="current-page-indicator-dot" />
          Schedule
        </span>
        <span className="spacer" />
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-nav-link">Dashboard</Link>
      </header>

      <main className="content schedule-page">
        <section className="card schedule-next">
          <p className="schedule-eyebrow">Next session</p>
          {next && !nextInPast ? (
            <>
              <h2>{next.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h2>
              <p className="schedule-next-time">{next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
              {isDM && <button className="ghost mini" onClick={clearLock}>Clear</button>}
            </>
          ) : (
            <p className="muted">
              {isDM ? "Not set yet. Pick a day below once people have marked when they're free." : "Not set yet. Mark the days you're free below."}
            </p>
          )}
        </section>

        {bestDays.length > 0 && (
          <section className="card schedule-best">
            <p className="schedule-eyebrow">Best days so far</p>
            <div className="schedule-best-days">
              {bestDays.map((d) => (
                <button key={d.day} type="button" className={`schedule-best-day${d.everyone ? " is-everyone" : ""}`}
                  onClick={() => isDM && setLockDay(d.day)} disabled={!isDM}>
                  <strong>{dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}</strong>
                  <small>{d.everyone ? "Everyone's free" : `${d.free} free${d.maybe ? ` · ${d.maybe} maybe` : ""}`}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {error && <div className="error">{error}</div>}
        {notice && <div className="schedule-notice">{notice}</div>}

        {isDM && lockDay && (
          <section className="card schedule-lock">
            <p className="schedule-eyebrow">Lock in {dayLabel(lockDay, { weekday: "long", day: "numeric", month: "long" })}</p>
            <div className="schedule-lock-row">
              <label>
                <span className="small muted">Start time</span>
                <input type="time" value={lockTime} onChange={(e) => setLockTime(e.target.value)} />
              </label>
              <button className="primary" disabled={busy} onClick={lockIn}>
                {discord === "ready" ? "Lock in & post to Discord" : "Lock in"}
              </button>
              <button className="ghost" onClick={() => setLockDay(null)}>Cancel</button>
            </div>
            {discord && discord !== "ready" && <p className="small muted">{DISCORD_NOTE[discord].replace(/^Saved\. /, "")}</p>}
          </section>
        )}

        <section className="card schedule-grid-card">
          <div className="row-between">
            <p className="schedule-eyebrow">Who's free · next two weeks</p>
            {isDM && (
              <button className="ghost mini" disabled={busy || discord !== "ready"} onClick={askDiscord}
                title={discord === "ready" ? "Post a reminder to fill this in" : "Turn on Discord in the launcher to use this"}>
                Ask on Discord
              </button>
            )}
          </div>
          <p className="small muted">Tap your own row to cycle: free → maybe → busy → clear.{isDM && " Tap a date to lock it in."}</p>
          <div className="schedule-grid-scroll">
            <table className="schedule-grid">
              <thead>
                <tr>
                  <th scope="col" className="schedule-name-col">Player</th>
                  {days.map((day) => {
                    const stats = dayStats(day);
                    return (
                      <th key={day} scope="col" className={stats.everyone ? "is-everyone" : ""}>
                        <button type="button" disabled={!isDM} onClick={() => setLockDay(day)}
                          aria-label={`${dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}${isDM ? ", lock in" : ""}`}>
                          <small>{dayLabel(day, { weekday: "short" })}</small>
                          <strong>{fromIso(day).getDate()}</strong>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const mine = m.userId === user?.id;
                  return (
                    <tr key={m.userId} className={mine ? "is-mine" : ""}>
                      <th scope="row" className="schedule-name-col">
                        {m.name}
                        {(m.role === "dm" || m.role === "co-dm") && <span className="badge vis-badge">GM</span>}
                      </th>
                      {days.map((day) => {
                        const s = markOf(m.userId, day);
                        const label = s ? MARK_LABEL[s] : "Not marked";
                        return (
                          <td key={day}>
                            {mine ? (
                              <button type="button" className={`schedule-cell mark-${s || "none"}`} onClick={() => cycle(day)}
                                aria-label={`${dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}: ${label}`}>
                                {s === "yes" ? "✓" : s === "maybe" ? "?" : s === "no" ? "✕" : ""}
                              </button>
                            ) : (
                              <span className={`schedule-cell mark-${s || "none"}`} title={label}>
                                {s === "yes" ? "✓" : s === "maybe" ? "?" : s === "no" ? "✕" : ""}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
