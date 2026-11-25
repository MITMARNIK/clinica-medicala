const {
  timeToMinutes,
  minutesToTime,
  normalizeTime,
  getIsoDayOfWeek,
  generateSlots
} = require('../src/utils/timeSlots');

describe('Unit Tests — Time Slots & Schedule Utilities', () => {
  test('converts time strings to minutes and back accurately', () => {
    expect(timeToMinutes('09:30:00')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30:00');
  });

  test('normalizes HH:MM and HH:MM:SS formats and rejects invalid times', () => {
    expect(normalizeTime('9:00')).toBe('09:00:00');
    expect(normalizeTime('14:30:00')).toBe('14:30:00');
    expect(normalizeTime('25:00')).toBeNull();
    expect(normalizeTime('invalid')).toBeNull();
  });

  test('computes ISO day of week (Mon=1 .. Sun=7)', () => {
    // 2026-11-23 is Monday, 2026-11-28 is Saturday, 2026-11-29 is Sunday
    expect(getIsoDayOfWeek('2026-11-23')).toBe(1);
    expect(getIsoDayOfWeek('2026-11-27')).toBe(5);
    expect(getIsoDayOfWeek('2026-11-28')).toBe(6);
    expect(getIsoDayOfWeek('2026-11-29')).toBe(7);
    expect(getIsoDayOfWeek('2026-02-30')).toBeNull();
  });

  test('generates discrete 30-minute consultation slots', () => {
    const slots = generateSlots('09:00:00', '11:00:00', 30);
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({ start_time: '09:00:00', end_time: '09:30:00' });
    expect(slots[3]).toEqual({ start_time: '10:30:00', end_time: '11:00:00' });
  });
});
