import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoLayer } from './videoLayer';

describe('VideoLayer', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('bgVideoElはvideoElとは別のHTMLVideoElementで、常時mutedである', () => {
    const layer = new VideoLayer({ w: 1080, h: 608 });

    expect(layer.bgVideoEl).toBeInstanceOf(HTMLVideoElement);
    expect(layer.bgVideoEl).not.toBe(layer.videoEl);
    expect(layer.bgVideoEl.muted).toBe(true);
  });

  it('loadFile()でvideoElとbgVideoElに同じObject URLが設定される', () => {
    const layer = new VideoLayer({ w: 1080, h: 608 });
    const file = new File([new Uint8Array([0, 0, 0, 0])], 'sample.mp4', { type: 'video/mp4' });

    layer.loadFile(file);

    expect(layer.videoEl.src).toBe('blob:mock');
    expect(layer.bgVideoEl.src).toBe('blob:mock');
  });

  it('setFitMode/setPosition/setScaleの反映後、videoElとbgVideoElのスタイルが常に一致する', () => {
    const layer = new VideoLayer({ w: 608, h: 1080 });
    layer.model.naturalWidth = 1920;
    layer.model.naturalHeight = 1080;

    layer.setFitMode('cover');
    expect(layer.bgVideoEl.style.left).toBe(layer.videoEl.style.left);
    expect(layer.bgVideoEl.style.top).toBe(layer.videoEl.style.top);
    expect(layer.bgVideoEl.style.width).toBe(layer.videoEl.style.width);
    expect(layer.bgVideoEl.style.height).toBe(layer.videoEl.style.height);
    expect(layer.bgVideoEl.style.transform).toBe(layer.videoEl.style.transform);

    layer.setPosition(10, 20);
    expect(layer.bgVideoEl.style.left).toBe(layer.videoEl.style.left);
    expect(layer.bgVideoEl.style.top).toBe(layer.videoEl.style.top);

    layer.setScale(2);
    expect(layer.bgVideoEl.style.transform).toBe(layer.videoEl.style.transform);
    expect(layer.bgVideoEl.style.transform).toBe('scale(2)');
  });

  it('togglePlay()で前景・背面両方のplay/pauseが同時に呼ばれる', () => {
    const layer = new VideoLayer({ w: 1080, h: 608 });
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    layer.togglePlay();
    expect(playSpy).toHaveBeenCalledTimes(2);

    Object.defineProperty(layer.videoEl, 'paused', { value: false, configurable: true });
    layer.togglePlay();
    expect(pauseSpy).toHaveBeenCalledTimes(2);

    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  it('seekTo()で前景・背面両方のcurrentTimeが同じ値になる', () => {
    const layer = new VideoLayer({ w: 1080, h: 608 });

    layer.seekTo(12.5);

    expect(layer.videoEl.currentTime).toBe(12.5);
    expect(layer.bgVideoEl.currentTime).toBe(12.5);
  });

  it('destroy()で前景・背面両方の<video>要素がDOMから取り除かれる', () => {
    const layer = new VideoLayer({ w: 1080, h: 608 });
    document.body.appendChild(layer.videoEl);
    document.body.appendChild(layer.bgVideoEl);

    layer.destroy();

    expect(layer.videoEl.isConnected).toBe(false);
    expect(layer.bgVideoEl.isConnected).toBe(false);
  });
});
