import { useEffect, useState } from "react";
import { entranceDone, whenEntranceDone } from "./entranceGate";

/** Re-renders once the opening video is gone. */
export function useEntranceDone(): boolean {
  const [done, setDone] = useState(entranceDone);
  useEffect(() => (done ? undefined : whenEntranceDone(() => setDone(true))), [done]);
  return done;
}
