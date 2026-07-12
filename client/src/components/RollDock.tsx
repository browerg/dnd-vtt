import { useEffect, useRef, useState } from "react";
import type { RollPayload } from "../api";
import RollFeed from "./RollFeed";

interface Props {
  rolls: RollPayload[];
  defaultOpen?: boolean;
}

// Collapsible roll log (bottom-right). While collapsed, new rolls raise a small
// toast and bump an unread badge — "notifications based on roll to all players,
// click to open the log." Opening clears the unread count.
export default function RollDock({ rolls, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem("dock-rolls-open");
    return saved === null ? defaultOpen : saved === "1";
  });
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<RollPayload | null>(null);
  const prevLen = useRef(rolls.length);
  const toastTimer = useRef<number | undefined>(undefined);
  // Navigating to a page fetches the whole roll history at once; that initial
  // hydration shouldn't fire a toast or bump the unread count. Only rolls that
  // land after the dock has settled are real "new roll" notifications.
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (rolls.length > prevLen.current) {
      const isHydration = Date.now() - mountedAt.current < 1200;
      const latest = rolls[rolls.length - 1];
      if (!open && !isHydration) {
        setUnread((n) => n + (rolls.length - prevLen.current));
        setToast(latest);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 4200);
      }
    }
    prevLen.current = rolls.length;
  }, [rolls, open]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      localStorage.setItem("dock-rolls-open", next ? "1" : "0");
      if (next) {
        setUnread(0);
        setToast(null);
      }
      return next;
    });
  };

  return (
    <div className={`dock roll-dock${open ? " open" : ""}`}>
      {open ? (
        <div className="dock-body">
          <div className="dock-head">
            <h4>📜 Rolls</h4>
            <button type="button" className="dock-collapse" title="Collapse" onClick={toggle}>
              ▾
            </button>
          </div>
          <RollFeed rolls={rolls} />
        </div>
      ) : (
        <>
          {toast && (
            <button type="button" className="roll-toast" onClick={toggle} title="Open roll log">
              <strong>{toast.userName}</strong>
              {toast.label && <span className="muted"> · {toast.label}</span>}
              {toast.detail && !toast.detail.manual ? (
                <span className="toast-total">{toast.total}</span>
              ) : toast.detail?.manual ? (
                <span className="toast-total">{toast.total}</span>
              ) : (
                <span className="muted"> · blind</span>
              )}
            </button>
          )}
          <button type="button" className="dock-tab" title="Roll log" onClick={toggle}>
            📜
            {unread > 0 && <span className="dock-badge">{unread > 9 ? "9+" : unread}</span>}
          </button>
        </>
      )}
    </div>
  );
}
