/**
 * `setPointerCapture` throws if the pointer is no longer active (e.g. it was
 * released or cancelled before the handler ran). Dragging still works without
 * capture, so don't let that crash the canvas.
 */
export function capturePointer(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {}
}
