import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasController } from './canvas';
import { initControls } from './controls';

/**
 * initControls()が要求するDOM構造(index.htmlの主要要素、ミュートトグルを含む)を
 * document.bodyへ組み立てる。
 * @returns テストで参照する主要な要素群
 */
function setupDom(): {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  muteToggle: HTMLInputElement;
} {
  document.body.innerHTML = `
    <input id="canvas-width" type="number" value="1080" />
    <input id="canvas-height" type="number" value="608" />
    <select id="canvas-preset"></select>
    <input id="file-input" type="file" />
    <select id="fit-mode">
      <option value="cover">Cover</option>
      <option value="contain">Contain</option>
      <option value="custom">Custom</option>
    </select>
    <input id="scale-range" type="range" value="1" />
    <input id="scale-number" type="number" value="1" />
    <input id="pos-x" type="number" value="0" />
    <input id="pos-y" type="number" value="0" />
    <button id="play-pause" type="button">再生</button>
    <input id="mute-toggle" type="checkbox" checked />
    <span id="time-display"></span>
    <input id="seek" type="range" value="0" />
    <button id="export-btn" type="button" disabled>エクスポート</button>
    <button id="export-cancel-btn" type="button" hidden>キャンセル</button>
    <div id="export-overlay" hidden>
      <p id="export-overlay-text"></p>
    </div>
    <section id="stage">
      <div class="canvas-frame" id="canvas-frame">
        <div id="canvas"></div>
      </div>
    </section>
  `;
  return {
    stageEl: document.getElementById('stage') as HTMLElement,
    canvasEl: document.getElementById('canvas') as HTMLElement,
    muteToggle: document.getElementById('mute-toggle') as HTMLInputElement,
  };
}

/** ステージへ動画ファイルをドロップし、動画を読み込ませる */
function dropVideoFile(stageEl: HTMLElement): void {
  const videoFile = new File([new Uint8Array([0, 0, 0, 0])], 'sample.mp4', { type: 'video/mp4' });
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [videoFile] } });
  stageEl.dispatchEvent(event);
}

describe('ミュートトグル', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('初期表示ではミュートトグルがチェック済み(ミュート)である', () => {
    const { muteToggle } = setupDom();
    const canvasController = new CanvasController(document.getElementById('canvas') as HTMLElement, {
      width: 1080,
      height: 608,
    });
    initControls(canvasController);

    expect(muteToggle.checked).toBe(true);
  });

  it('動画読み込み時、既定でvideoElがミュートされている', () => {
    const { stageEl, canvasEl } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);
    dropVideoFile(stageEl);

    const videoEl = canvasEl.querySelector('video') as HTMLVideoElement;
    expect(videoEl.muted).toBe(true);
  });

  it('ミュートトグルのチェックを外すと、videoElのミュートが解除される', () => {
    const { stageEl, canvasEl, muteToggle } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);
    dropVideoFile(stageEl);

    muteToggle.checked = false;
    muteToggle.dispatchEvent(new Event('change'));

    const videoEl = canvasEl.querySelector('video') as HTMLVideoElement;
    expect(videoEl.muted).toBe(false);
  });

  it('ミュート解除した状態で別の動画を読み込むと、新しいvideoElにもミュート解除状態が引き継がれる', () => {
    const { stageEl, canvasEl, muteToggle } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);
    dropVideoFile(stageEl);

    muteToggle.checked = false;
    muteToggle.dispatchEvent(new Event('change'));

    dropVideoFile(stageEl);

    const videoEl = canvasEl.querySelector('video') as HTMLVideoElement;
    expect(videoEl.muted).toBe(false);
  });
});
