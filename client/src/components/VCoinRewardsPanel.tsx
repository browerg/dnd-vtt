import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type Member } from "../api";
import "./VCoinRewardsPanel.css";

interface RewardEvent {
  id: number;
  amount: number;
  reason: string;
  source: "dm" | "quest";
  createdAt: string;
  awardedByName: string;
  targetName: string | null;
}

interface Props {
  campaignId: number;
  members: Member[];
  refreshKey: number;
}

export default function VCoinRewardsPanel({ campaignId, members, refreshKey }: Props) {
  const [target, setTarget] = useState("everyone");
  const [amount, setAmount] = useState(25);
  const [reason, setReason] = useState("");
  const [rewards, setRewards] = useState<RewardEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const eligible = useMemo(
    () => members.filter((member) => member.role !== "spectator"),
    [members]
  );

  const load = useCallback(() => {
    api<{ rewards: RewardEvent[] }>(`/api/campaigns/${campaignId}/vcoins/rewards`)
      .then((response) => setRewards(response.rewards))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await api<{
        amount: number;
        recipientCount: number;
        targetName: string | null;
      }>(`/api/campaigns/${campaignId}/vcoins/award`, {
        method: "POST",
        body: JSON.stringify({
          targetUserId: target === "everyone" ? null : Number(target),
          amount,
          reason,
        }),
      });

      setSuccess(
        response.targetName
          ? `Awarded ${response.amount} VCoins to ${response.targetName}.`
          : `Awarded ${response.amount} VCoins to ${response.recipientCount} campaign members.`
      );
      setReason("");
      load();
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vcoin-rewards-panel">
      <form className="stack vcoin-reward-form" onSubmit={submit}>
        <label>
          Give to
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="everyone">Everyone</option>
            {eligible.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Amount
          <input
            type="number"
            min={1}
            max={500}
            value={amount}
            onChange={(event) =>
              setAmount(Math.max(1, Math.min(500, Number(event.target.value) || 1)))
            }
          />
        </label>

        <div className="vcoin-quick-amounts" aria-label="Quick VCoin amounts">
          {[10, 25, 50, 100].map((value) => (
            <button
              key={value}
              type="button"
              className={amount === value ? "ghost mini active" : "ghost mini"}
              onClick={() => setAmount(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <label>
          Reason
          <input
            value={reason}
            maxLength={120}
            placeholder="Great roleplay moment, session bonus…"
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </label>

        <button className="primary" disabled={busy || !reason.trim()}>
          {busy ? "Awarding…" : `Award ${amount} VCoins`}
        </button>
      </form>

      {error && <div className="error small">{error}</div>}
      {success && <div className="vcoin-reward-success small">{success}</div>}

      <div className="vcoin-recent">
        <div className="row-between">
          <strong>Recent rewards</strong>
          <span className="muted small">Quest rewards vary by quest</span>
        </div>

        {rewards.length === 0 ? (
          <p className="muted small">No VCoin rewards in this campaign yet.</p>
        ) : (
          <ul className="vcoin-reward-list">
            {rewards.map((reward) => (
              <li key={reward.id}>
                <div className="row-between">
                  <span>
                    <strong>+{reward.amount}</strong>{" "}
                    {reward.targetName ?? "Everyone"}
                  </span>
                  <span className={`badge vcoin-source-${reward.source}`}>
                    {reward.source === "quest" ? "QUEST" : "DM"}
                  </span>
                </div>
                <div className="muted small">{reward.reason}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
