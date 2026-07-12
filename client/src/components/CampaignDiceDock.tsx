import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, type RollPayload } from "../api";
import { animateRoll } from "../dice3d";
import DiceDock from "./DiceDock";

// A fully self-contained floating dice dock for any campaign screen that doesn't
// already own the roll pipeline (character sheet, bestiary): it learns the
// system + whether you can roll, posts rolls, and animates incoming 3D dice.
// Pages that already handle "roll" (dashboard/hub/map) use <DiceDock> directly
// so the dice don't animate twice.
export default function CampaignDiceDock() {
  const { id } = useParams();
  const campaignId = Number(id);
  const [system, setSystem] = useState("dnd5e");
  const [canRoll, setCanRoll] = useState(false);

  useEffect(() => {
    api<{ campaign: { system: string }; yourRole: string }>(`/api/campaigns/${campaignId}`)
      .then((r) => {
        setSystem(r.campaign.system);
        setCanRoll(r.yourRole !== "spectator");
      })
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("roll", async (roll: RollPayload) => {
      if (roll.campaignId !== campaignId) return;
      if (roll.detail) await animateRoll(roll.detail, roll.diceTheme);
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

  if (!canRoll) return null;
  return <DiceDock onRoll={doRoll} system={system} />;
}
