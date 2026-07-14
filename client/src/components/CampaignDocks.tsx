import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, type RollPayload } from "../api";
import { animateRoll } from "../dice3d";
import DiceDock from "./DiceDock";
import RollDock from "./RollDock";

// Self-contained floating docks (dice bottom-left + roll log / notifications
// bottom-right) for any campaign screen that doesn't already own the roll
// pipeline (character sheet, bestiary). It learns the system + whether you can
// roll, seeds + live-updates the roll list, posts rolls, and animates 3D dice.
// Pages that already handle "roll" (dashboard/hub/map) wire the docks to their
// own state instead, so nothing animates or renders twice.
export default function CampaignDocks() {
  const { id } = useParams();
  const campaignId = Number(id);
  const [system, setSystem] = useState("dnd5e");
  const [canRoll, setCanRoll] = useState(false);
  const [rolls, setRolls] = useState<RollPayload[]>([]);
  // Hold the roll dock until history has loaded, so it never sees the 0→N jump
  // and mis-reads it as a pile of new-roll notifications.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<{ campaign: { system: string }; yourRole: string }>(`/api/campaigns/${campaignId}`)
      .then((r) => {
        setSystem(r.campaign.system);
        setCanRoll(r.yourRole !== "spectator");
      })
      .catch(() => {});
    api<{ rolls: RollPayload[] }>(`/api/campaigns/${campaignId}/rolls`)
      .then((r) => setRolls(r.rolls))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [campaignId]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("roll", async (roll: RollPayload) => {
      if (roll.campaignId !== campaignId) return;
      if (roll.detail) await animateRoll(roll.detail, roll.diceTheme, { userName: roll.userName, label: roll.label });
      setRolls((prev) => [...prev.slice(-99), roll]);
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId]);

  const doRoll = useCallback(
    async (body: { formula: string; label: string; mode: string; visibility: string; manual?: boolean; total?: number }) => {
      await api(`/api/campaigns/${campaignId}/rolls`, { method: "POST", body: JSON.stringify(body) });
    },
    [campaignId]
  );

  return (
    <>
      {canRoll && <DiceDock onRoll={doRoll} system={system} />}
      {loaded && <RollDock rolls={rolls} />}
    </>
  );
}
