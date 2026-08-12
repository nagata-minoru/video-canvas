import { describe, expect, it } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
  it('0秒は00:00になる', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('1分未満は秒のみ2桁で表示される', () => {
    expect(formatTime(45)).toBe('00:45');
  });

  it('分と秒が両方2桁でパディングされる', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  it('小数点以下は切り捨てられる', () => {
    expect(formatTime(59.9)).toBe('00:59');
  });

  it('1時間以上でも分が2桁を超えてそのまま表示される', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('負の値は00:00になる', () => {
    expect(formatTime(-5)).toBe('00:00');
  });

  it('NaNは00:00になる', () => {
    expect(formatTime(NaN)).toBe('00:00');
  });

  it('Infinityは00:00になる', () => {
    expect(formatTime(Infinity)).toBe('00:00');
  });
});
