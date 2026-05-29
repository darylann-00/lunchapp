import { describe, it, expect } from 'vitest';
import { splitPrepSteps, dishSteps, isDishPrepped, toggleStep } from './prepSteps';

describe('splitPrepSteps', () => {
  it('returns [] for empty input', () => {
    expect(splitPrepSteps('')).toEqual([]);
    expect(splitPrepSteps('   ')).toEqual([]);
  });

  it('splits on newlines', () => {
    expect(splitPrepSteps('Spread butter\nAdd jam\nCut in half')).toEqual([
      'Spread butter',
      'Add jam',
      'Cut in half',
    ]);
  });

  it('falls back to sentence splitting when single line', () => {
    expect(splitPrepSteps('Wash the apple. Slice it thin. Pack it up.')).toEqual([
      'Wash the apple.',
      'Slice it thin.',
      'Pack it up.',
    ]);
  });

  it('strips leading list markers', () => {
    expect(splitPrepSteps('1. Boil water\n2) Add pasta\n- Drain\nStep 4: Serve')).toEqual([
      'Boil water',
      'Add pasta',
      'Drain',
      'Serve',
    ]);
  });

  it('treats a single sentence as one step', () => {
    expect(splitPrepSteps('Just open the package')).toEqual(['Just open the package']);
  });
});

describe('dishSteps', () => {
  it('falls back to a Pack step when no prep notes', () => {
    expect(dishSteps('String Cheese', '')).toEqual(['Pack String Cheese']);
  });

  it('uses parsed steps when present', () => {
    expect(dishSteps('PB&J', 'Spread PB\nSpread J')).toEqual(['Spread PB', 'Spread J']);
  });
});

describe('isDishPrepped', () => {
  const notes = 'Spread butter\nAdd jam\nCut in half';

  it('false when not all steps checked', () => {
    expect(isDishPrepped('d1', 'Toast', notes, { d1: [0, 1] })).toBe(false);
  });

  it('true when all steps checked', () => {
    expect(isDishPrepped('d1', 'Toast', notes, { d1: [0, 1, 2] })).toBe(true);
  });

  it('false with no progress', () => {
    expect(isDishPrepped('d1', 'Toast', notes, {})).toBe(false);
  });

  it('true for a no-prep dish once its single Pack step is checked', () => {
    expect(isDishPrepped('d2', 'Grapes', '', { d2: [0] })).toBe(true);
    expect(isDishPrepped('d2', 'Grapes', '', {})).toBe(false);
  });
});

describe('toggleStep', () => {
  it('adds an unchecked step', () => {
    expect(toggleStep({}, 'd1', 2)).toEqual({ d1: [2] });
  });

  it('removes a checked step', () => {
    expect(toggleStep({ d1: [0, 2] }, 'd1', 2)).toEqual({ d1: [0] });
  });

  it('keeps indices sorted and other dishes intact', () => {
    expect(toggleStep({ d1: [2], d2: [0] }, 'd1', 0)).toEqual({ d1: [0, 2], d2: [0] });
  });
});
