import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
}) {
  const ref = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key === "Tab" && node) {
        const focusable = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );
        if (focusable.length === 0) return;
        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <div className="modal__header">
          <div>
            {title && (
              <h2 className="modal__title" id="modal-title">
                {title}
              </h2>
            )}
            {description && <p className="modal__desc">{description}</p>}
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
