import { describe, it, expect } from 'vitest';
import { validateNoDuplicatePicks } from './tradeValidation';
import type { TradePickRef } from '../types/state';

describe('validateNoDuplicatePicks', () => {
  it('should return ok: true for a trade with no duplicate picks', () => {
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2026, round: 2, originalOwnerId: 'team1' },
      { year: 2027, round: 1, originalOwnerId: 'team1' },
    ];

    const result = validateNoDuplicatePicks(picks);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return ok: false when the same pick appears twice', () => {
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2026, round: 1, originalOwnerId: 'team1' }, // duplicate
    ];

    const result = validateNoDuplicatePicks(picks);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Duplicate picks found');
    expect(result.error).toContain('2026 Round 1');
  });

  it('should return ok: false when multiple duplicates exist', () => {
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2026, round: 1, originalOwnerId: 'team1' }, // duplicate 1
      { year: 2027, round: 2, originalOwnerId: 'team2' },
      { year: 2027, round: 2, originalOwnerId: 'team2' }, // duplicate 2
    ];

    const result = validateNoDuplicatePicks(picks);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Duplicate picks found');
    expect(result.error).toContain('2026 Round 1');
    expect(result.error).toContain('2027 Round 2');
  });

  it('should allow different picks with same year/round but different originalOwnerId', () => {
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2026, round: 1, originalOwnerId: 'team2' }, // different original owner, not a duplicate
    ];

    const result = validateNoDuplicatePicks(picks);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return ok: false for empty picks array', () => {
    const picks: TradePickRef[] = [];

    const result = validateNoDuplicatePicks(picks);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('at least one pick');
  });

  it('should detect duplicate even if picks are in different order', () => {
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2027, round: 2, originalOwnerId: 'team2' },
      { year: 2026, round: 1, originalOwnerId: 'team1' }, // duplicate, different position
    ];

    const result = validateNoDuplicatePicks(picks);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Duplicate picks found');
  });
});

