import { useLayoutEffect } from "react";

// Keep keyboard navigation inside an open modal and return to its trigger.
export default function useDialogFocus(open, dialogRef) {
  useLayoutEffect(() => {
    if (!open) return undefined;
    const trigger = document.activeElement;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const focusable = () => [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex="0"]')]
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    if (!dialog.contains(document.activeElement)) (focusable()[0] || dialog).focus();
    const handleKey = (event) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0] || dialog;
      const last = items[items.length - 1] || dialog;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, dialogRef]);
}
