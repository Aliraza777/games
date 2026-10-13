/**
 * Keys currently held, tracked app-wide from startup. A new run can start
 * mid-press (e.g. W held through the menu transition) and still respond.
 */
export const heldKeys = new Set<string>();

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => heldKeys.add(e.key.toLowerCase()), true);
  window.addEventListener('keyup', (e) => heldKeys.delete(e.key.toLowerCase()), true);
  window.addEventListener('blur', () => heldKeys.clear());
}
