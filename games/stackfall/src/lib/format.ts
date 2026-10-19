export const fmtScore = (n: number) => Math.round(n).toLocaleString('en-US');

/** 83456 → "1:23.45" */
export function fmtTime(ms: number, hundredths = true): string {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const cs = Math.floor((t % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}${hundredths ? `.${String(cs).padStart(2, '0')}` : ''}`;
}

/** Human key name for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space',
    ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'Alt', AltRight: 'R-Alt', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫', Slash: '/',
    Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export function untilMidnight(now = new Date()): string {
  const m = new Date(now);
  m.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((m.getTime() - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
