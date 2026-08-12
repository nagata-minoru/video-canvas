import { describe, expect, it } from 'vitest';
import { pickSupportedMimeType } from './exporter';

describe('pickSupportedMimeType', () => {
  it('先頭からサポートされている候補を返す', () => {
    const isSupported = (type: string) => type === 'video/webm;codecs=vp8,opus' || type === 'video/webm';
    const result = pickSupportedMimeType(
      ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
      isSupported,
    );
    expect(result).toBe('video/webm;codecs=vp8,opus');
  });

  it('先頭候補がサポートされていればそれを返す', () => {
    const result = pickSupportedMimeType(['video/webm', 'video/mp4'], () => true);
    expect(result).toBe('video/webm');
  });

  it('どの候補もサポートされていなければnullを返す', () => {
    const result = pickSupportedMimeType(['video/webm', 'video/mp4'], () => false);
    expect(result).toBeNull();
  });
});
