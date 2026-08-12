import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasExporter, extensionForMimeType, MIME_CANDIDATES, pickSupportedMimeType } from './exporter';

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

describe('record()の音声トラック制御', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // @ts-expect-error jsdomに存在しないプロパティをテスト用に直接代入したものを後始末する
    delete HTMLCanvasElement.prototype.captureStream;
  });

  /** jsdomにネイティブ実装がない2D描画コンテキストをテスト用にモックする(描画内容自体は検証対象外) */
  function mockCanvasContext(): void {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  }

  /**
   * record()が音声トラックをcanvasStreamへ追加するかどうかだけを検証するためのモック一式を用意する。
   * videoEl.play()を即rejectさせ、動画デコードを伴わずに音声トラック追加処理まで到達させる。
   * @param muted 検証対象のvideoEl.mutedの値
   * @returns canvasStream.addTrack()に実際に渡されたトラック一覧
   */
  async function captureAddedAudioTracks(muted: boolean): Promise<MediaStreamTrack[]> {
    mockCanvasContext();
    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported(): boolean {
          return true;
        }
      },
    );

    const addedTracks: MediaStreamTrack[] = [];
    const canvasStream = { addTrack: (track: MediaStreamTrack) => addedTracks.push(track) } as unknown as MediaStream;
    HTMLCanvasElement.prototype.captureStream = vi.fn(() => canvasStream);

    const audioTrack = {} as MediaStreamTrack;
    const videoEl = document.createElement('video');
    videoEl.muted = muted;
    videoEl.captureStream = vi.fn(() => ({ getAudioTracks: () => [audioTrack] }) as unknown as MediaStream);
    videoEl.play = vi.fn(() => Promise.reject(new Error('デコード不要のためテストではplay()を失敗させる')));

    const exporter = new CanvasExporter({ width: 100, height: 100 });
    await exporter
      .record(videoEl, () => ({ x: 0, y: 0, width: 100, height: 100, scale: 1 }))
      .catch(() => {});

    return addedTracks;
  }

  it('videoEl.mutedがfalseなら音声トラックがcanvasStreamへ追加される', async () => {
    const addedTracks = await captureAddedAudioTracks(false);
    expect(addedTracks).toHaveLength(1);
  });

  it('videoEl.mutedがtrueなら音声トラックはcanvasStreamへ追加されない', async () => {
    const addedTracks = await captureAddedAudioTracks(true);
    expect(addedTracks).toHaveLength(0);
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
