/**
 * Physical keys currently held (KeyboardEvent.code), tracked app-wide from
 * startup. A new run can start mid-press (W held through the menu transition)
 * and still respond. Codes, not characters: Shift+1 is still Digit1, and WASD
 * means the same physical keys on AZERTY or Dvorak.
 */
export const heldKeys = new Set<string>();

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => heldKeys.add(e.code), true);
  window.addEventListener('keyup', (e) => heldKeys.delete(e.code), true);
  window.addEventListener('blur', () => heldKeys.clear());
}

export type Action = 'gas' | 'brake' | 'back' | 'fwd' | 'hop' | 'focus';

export const KEY_ACTIONS: Record<string, Action> = {
  KeyW: 'gas',
  ArrowUp: 'gas',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'back',
  ArrowLeft: 'back',
  KeyD: 'fwd',
  ArrowRight: 'fwd',
  Space: 'hop',
  ShiftLeft: 'focus',
  ShiftRight: 'focus',
};

export const INK_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
