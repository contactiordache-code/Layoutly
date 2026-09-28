// Entry for the React bundle loaded by the Electron renderer (src/renderer/ui/style-board.js).
// It is built as an IIFE, so these exports are available on `window.LayoutlyUI`.
import "@/styles/globals.css";
import SiteStyleBoard, { type StyleBoardProps } from "@/components/style-board/site-style-board";
import { createRoot, type Root } from "react-dom/client";

const roots = new WeakMap<Element, Root>();

export function renderStyleBoard(container: Element, props: StyleBoardProps) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  // Keyed by site: Swapy moves DOM nodes itself, so a new site gets a fresh board.
  root.render(<SiteStyleBoard key={props.style.host} {...props} />);
}

export function unmountStyleBoard(container: Element) {
  roots.get(container)?.unmount();
  roots.delete(container);
}
