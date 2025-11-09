import { describe, it, expect } from 'vitest';
import { validateNoDuplicatePicks, isPickLockedByStepienRule, validateStepienRule } from './tradeValidation';
import type { TradePickRef, State } from '../types/state';

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

describe('isPickLockedByStepienRule', () => {
  const createBaseState = (): State => ({
    teams: [
      { id: 'team1', name: 'Team 1' },
      { id: 'team2', name: 'Team 2' },
    ],
    basePicks: [
      { year: 2026, round: 1, originalOwnerId: 'team1', currentOwnerId: 'team1' },
      { year: 2027, round: 1, originalOwnerId: 'team1', currentOwnerId: 'team1' },
      { year: 2028, round: 1, originalOwnerId: 'team1', currentOwnerId: 'team1' },
      { year: 2026, round: 2, originalOwnerId: 'team1', currentOwnerId: 'team1' },
    ],
    trades: [],
  });

  it('should return false for non-1st-round picks', () => {
    const state = createBaseState();
    expect(isPickLockedByStepienRule(state, 'team1', 2026, 2)).toBe(false);
  });

  it('should return false if team owns previous year 1st round', () => {
    const state = createBaseState();
    // team1 owns 2026 R1, so they can trade 2027 R1
    expect(isPickLockedByStepienRule(state, 'team1', 2027, 1)).toBe(false);
  });

  it('should return true if team does not own previous year 1st round', () => {
    const state: State = {
      ...createBaseState(),
      trades: [
        {
          id: 'trade1',
          createdAt: new Date().toISOString(),
          fromTeamId: 'team1',
          toTeamId: 'team2',
          picks: [{ year: 2026, round: 1, originalOwnerId: 'team1' }],
        },
      ],
    };
    // team1 traded away 2026 R1, so 2027 R1 is locked
    expect(isPickLockedByStepienRule(state, 'team1', 2027, 1)).toBe(true);
  });

  it('should return false for first year (no previous year to check)', () => {
    const state = createBaseState();
    // 2026 is the first year, so it can't be locked
    expect(isPickLockedByStepienRule(state, 'team1', 2026, 1)).toBe(false);
  });
});

describe('validateStepienRule', () => {
  const createBaseState = (): State => ({
    teams: [
      { id: 'team1', name: 'Team 1' },
      { id: 'team2', name: 'Team 2' },
    ],
    basePicks: [
      { year: 2026, round: 1, originalOwnerId: 'team1', currentOwnerId: 'team1' },
      { year: 2027, round: 1, originalOwnerId: 'team1', currentOwnerId: 'team1' },
      { year: 2028, round: 1, originalOwnerId: 'team1', currentOwnerId: 'team1' },
    ],
    trades: [],
  });

  it('should return ok: true for valid trades', () => {
    const state = createBaseState();
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
    ];

    const result = validateStepienRule(state, 'team1', picks);
    expect(result.ok).toBe(true);
  });

  it('should return ok: false when trading two consecutive 1st round picks in same trade', () => {
    const state = createBaseState();
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2027, round: 1, originalOwnerId: 'team1' }, // consecutive
    ];

    const result = validateStepienRule(state, 'team1', picks);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('consecutive 1st round picks');
    expect(result.error).toContain('2026');
    expect(result.error).toContain('2027');
  });

  it('should return ok: true when trading non-consecutive 1st round picks', () => {
    const state = createBaseState();
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2028, round: 1, originalOwnerId: 'team1' }, // not consecutive
    ];

    const result = validateStepienRule(state, 'team1', picks);
    expect(result.ok).toBe(true);
  });

  it('should return ok: true when trading 1st and 2nd round picks together', () => {
    const state = createBaseState();
    const picks: TradePickRef[] = [
      { year: 2026, round: 1, originalOwnerId: 'team1' },
      { year: 2026, round: 2, originalOwnerId: 'team1' },
      { year: 2027, round: 2, originalOwnerId: 'team1' },
    ];

    const result = validateStepienRule(state, 'team1', picks);
    expect(result.ok).toBe(true);
  });

  it('should return ok: false when trading locked pick', () => {
    const state: State = {
      ...createBaseState(),
      trades: [
        {
          id: 'trade1',
          createdAt: new Date().toISOString(),
          fromTeamId: 'team1',
          toTeamId: 'team2',
          picks: [{ year: 2026, round: 1, originalOwnerId: 'team1' }],
        },
      ],
    };
    // team1 traded 2026 R1, so 2027 R1 is locked
    const picks: TradePickRef[] = [
      { year: 2027, round: 1, originalOwnerId: 'team1' },
    ];

    const result = validateStepienRule(state, 'team1', picks);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Stepien rule violation');
    expect(result.error).toContain('2027 Round 1');
  });

  it('should ignore non-1st-round picks', () => {
    const state: State = {
      ...createBaseState(),
      trades: [
        {
          id: 'trade1',
          createdAt: new Date().toISOString(),
          fromTeamId: 'team1',
          toTeamId: 'team2',
          picks: [{ year: 2026, round: 1, originalOwnerId: 'team1' }],
        },
      ],
    };
    // Round 2 picks are not affected
    const picks: TradePickRef[] = [
      { year: 2027, round: 2, originalOwnerId: 'team1' },
    ];

    const result = validateStepienRule(state, 'team1', picks);
    expect(result.ok).toBe(true);
  });
});
