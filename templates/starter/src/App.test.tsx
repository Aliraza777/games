import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { nextScore } from './game';

describe('game rules', () => {
  it('never drops below zero', () => {
    expect(nextScore(0, false)).toBe(0);
    expect(nextScore(2, true)).toBe(3);
  });
});

describe('App', () => {
  it('increments the score on click', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /score: 0/i }));
    expect(screen.getByRole('button', { name: /score: 1/i })).toBeInTheDocument();
  });
});
