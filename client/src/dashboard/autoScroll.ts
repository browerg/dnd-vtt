import { useCallback, useEffect, useRef } from "react";

const EDGE = 90; // px from the top/bottom of the viewport where scrolling starts
const MAX_SPEED = 24; // px per frame at the very edge

function scrollerFor(el: Element | null): HTMLElement {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * While a dashboard panel is being dragged or resized, holding the pointer
 * near the top or bottom edge scrolls the page. After each scroll step a
 * synthetic mousemove at the same spot lets react-draggable recompute the
 * panel's position, so it travels with the page instead of being left behind.
 */
export function useDragAutoScroll() {
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const scroller = useRef<HTMLElement | null>(null);

  const onMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!event.isTrusted) return;
    const point = "touches" in event ? event.touches[0] : event;
    if (point) pointer.current = { x: point.clientX, y: point.clientY };
  }, []);

  const tick = useCallback(() => {
    frame.current = requestAnimationFrame(tick);
    const at = pointer.current;
    const target = scroller.current;
    if (!at || !target) return;
    const bounds = target === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : target.getBoundingClientRect();
    let delta = 0;
    if (at.y < bounds.top + EDGE) delta = -Math.ceil(((bounds.top + EDGE - at.y) / EDGE) * MAX_SPEED);
    else if (at.y > bounds.bottom - EDGE) delta = Math.ceil(((at.y - (bounds.bottom - EDGE)) / EDGE) * MAX_SPEED);
    if (!delta) return;
    const before = target.scrollTop;
    target.scrollTop = before + delta;
    if (target.scrollTop === before) return;
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: at.x, clientY: at.y, bubbles: true }));
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    pointer.current = null;
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("touchmove", onMove, true);
  }, [onMove]);

  const start = useCallback(
    (_layout: unknown, _old: unknown, _item: unknown, _placeholder: unknown, event: MouseEvent, element: HTMLElement) => {
      stop();
      scroller.current = scrollerFor(element);
      if (event && "clientY" in event) pointer.current = { x: event.clientX, y: event.clientY };
      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("touchmove", onMove, true);
      frame.current = requestAnimationFrame(tick);
    },
    [onMove, stop, tick]
  );

  useEffect(() => stop, [stop]);
  return { start, stop };
}
