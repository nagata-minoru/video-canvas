import { describe, expect, it } from 'vitest';
import { extensionForMimeType, MIME_CANDIDATES, pickSupportedMimeType } from './exporter';

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

describe('MIME_CANDIDATES(実際の候補配列)', () => {
  it('MP4対応ブラウザではMP4候補が最優先で選ばれる', () => {
    const isSupported = (type: string) => MIME_CANDIDATES.includes(type);
    expect(pickSupportedMimeType(MIME_CANDIDATES, isSupported)).toBe('video/mp4;codecs=avc1,mp4a.40.2');
  });

  it('MP4非対応ブラウザ(Firefox等)ではWebMにフォールバックする', () => {
    const isSupported = (type: string) => type.startsWith('video/webm');
    expect(pickSupportedMimeType(MIME_CANDIDATES, isSupported)).toBe('video/webm;codecs=vp9,opus');
  });

  it('MP4もWebMも非対応ならnullを返す', () => {
    expect(pickSupportedMimeType(MIME_CANDIDATES, () => false)).toBeNull();
  });
});

describe('extensionForMimeType', () => {
  it('video/mp4系のMIMEタイプはmp4を返す', () => {
    expect(extensionForMimeType('video/mp4')).toBe('mp4');
    expect(extensionForMimeType('video/mp4;codecs=avc1,mp4a.40.2')).toBe('mp4');
  });

  it('video/webm系のMIMEタイプはwebmを返す', () => {
    expect(extensionForMimeType('video/webm')).toBe('webm');
    expect(extensionForMimeType('video/webm;codecs=vp9,opus')).toBe('webm');
  });

  it('未知のMIMEタイプは既定でwebmを返す', () => {
    expect(extensionForMimeType('')).toBe('webm');
    expect(extensionForMimeType('video/quicktime')).toBe('webm');
  });
});
