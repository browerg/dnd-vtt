import { useSyncExternalStore } from "react";
import "./GatewayPreview.css";

const KEY = "vivid-gateway-preview-v1";
let memory: boolean | undefined;
const read = () => {
  if (memory !== undefined) return memory;
  try { return localStorage.getItem(KEY) === "on"; } catch { return false; }
};
const subscribe = (update: () => void) => {
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) { memory = undefined; update(); }
  };
  window.addEventListener("gateway-preview-change", update);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener("gateway-preview-change", update); window.removeEventListener("storage", storage); };
};
export const useGatewayPreview = () => useSyncExternalStore(subscribe, read, () => false);
export default function GatewayPreviewToggle() {
  const enabled = useGatewayPreview();
  return <label className="gateway-preview-toggle"><input type="checkbox" checked={enabled} onChange={(event) => {
    memory = event.target.checked;
    try { localStorage.setItem(KEY, memory ? "on" : "off"); } catch { /* Session still works without storage. */ }
    window.dispatchEvent(new Event("gateway-preview-change"));
  }} /><span>Updated theme <small>· Preview</small></span></label>;
}
