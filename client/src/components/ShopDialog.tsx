import { useEffect, useRef, type ReactNode } from "react";
import "./ShopDialog.css";

/**
 * A modal for one slice of the catalogue.
 *
 * Built on the native <dialog> rather than a hand-rolled overlay: showModal()
 * brings the focus trap, Escape handling, backdrop and background inertness
 * with it, all of which are easy to get subtly wrong by hand.
 */
export default function ShopDialog({
  open,
  title,
  subtitle,
  meta,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(scrollIdle.current), []);

  // Cards slide under a still cursor while the list scrolls, and each one it
  // crosses would start its hover lift, shadow and sheen. Hold hover off until
  // the scroll settles.
  const markScrolling = (body: HTMLDivElement) => {
    if (!body.dataset.scrolling) body.dataset.scrolling = "";
    clearTimeout(scrollIdle.current);
    scrollIdle.current = setTimeout(() => { delete body.dataset.scrolling; }, 160);
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // Nothing below has been rendered yet on first paint, and mounting the grid
  // of a category nobody has opened is wasted work.
  if (!open) return <dialog ref={ref} className="shop-dialog" aria-label={title} />;

  return (
    <dialog
      ref={ref}
      className="shop-dialog"
      aria-labelledby="shop-dialog-title"
      onCancel={(event) => {
        // Escape: let React own the open state rather than the DOM.
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        // Anything that closes the element without going through React — a
        // stray close(), a form submit — would otherwise leave state saying
        // "open" and the dialog unable to reopen.
        if (open) onClose();
      }}
      onClick={(event) => {
        // A click that lands on the dialog itself is a click on the backdrop;
        // anything inside the panel stops before it gets here.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="shop-dialog-panel">
        <header>
          <div>
            <h2 id="shop-dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {meta && <span className="shop-dialog-meta">{meta}</span>}
          <button type="button" className="shop-dialog-close" onClick={onClose} aria-label={`Close ${title}`}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="shop-dialog-body" onScroll={(event) => markScrolling(event.currentTarget)}>{children}</div>
      </div>
    </dialog>
  );
}
