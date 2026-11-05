import { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body. Pop-ups use `position: fixed`, which a transformed
 * ancestor (the animated page cards) turns into a position relative to that ancestor,
 * clipping the pop-up; the portal keeps it centred on the viewport.
 */
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
