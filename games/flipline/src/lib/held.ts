/**
 * Keys and pointers currently held, tracked app-wide from startup. A ride that
 * begins mid-press (you tapped Play and kept holding through the transition)
 * starts moving immediately instead of waiting for a second press.
 */
export const heldKeys = new Set<string>();
export const heldPointers = new Set<number>();

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => heldKeys.add(e.code), true);
  window.addEventListener('keyup', (e) => heldKeys.delete(e.code), true);
  window.addEventListener('pointerdown', (e) => e.button === 0 && heldPointers.add(e.pointerId), true);
  window.addEventListener('pointerup', (e) => heldPointers.delete(e.pointerId), true);
  window.addEventListener('pointercancel', (e) => heldPointers.delete(e.pointerId), true);
  window.addEventListener('blur', () => {
    heldKeys.clear();
    heldPointers.clear();
  });
}
