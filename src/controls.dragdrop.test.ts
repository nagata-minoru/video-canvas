import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasController } from './canvas';
import { initControls } from './controls';

/**
 * initControls()が要求するDOM構造(index.htmlの主要要素)をdocument.bodyへ組み立てる。
 * @returns ドラッグ&ドロップの検証に使うステージ要素・キャンバス要素
 */
function setupDom(): { stageEl: HTMLElement; canvasEl: HTMLElement } {
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
    <span id="time-display"></span>
    <input id="seek" type="range" value="0" />
    <button id="export-btn" type="button" disabled>エクスポート</button>
    <button id="export-cancel-btn" type="button" hidden>キャンセル</button>
    <section id="stage">
      <div id="canvas"></div>
    </section>
  `;
  return {
    stageEl: document.getElementById('stage') as HTMLElement,
    canvasEl: document.getElementById('canvas') as HTMLElement,
  };
}

/**
 * DragEvent互換のイベントを生成する。jsdomはDragEventのdataTransfer/relatedTargetを
 * コンストラクタ引数から正しく設定できないため、通常のEventにプロパティを直接定義して代用する。
 * @param type イベント種別('dragenter' | 'dragleave' | 'dragover' | 'drop')
 * @param options relatedTarget(移動先要素)とdataTransfer(ドロップされたファイル情報など)
 * @returns 発火可能なEventオブジェクト
 */
function createDragEvent(
  type: string,
  options: { relatedTarget?: EventTarget | null; dataTransfer?: unknown } = {},
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'relatedTarget', { value: options.relatedTarget ?? null });
  Object.defineProperty(event, 'dataTransfer', { value: options.dataTransfer ?? null });
  return event;
}

/**
 * initControls()を初期化し、テスト対象のステージ・キャンバス要素を返す。
 * @returns ステージ要素・キャンバス要素
 */
function setup(): { stageEl: HTMLElement; canvasEl: HTMLElement } {
  const { stageEl, canvasEl } = setupDom();
  const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
  initControls(canvasController);
  return { stageEl, canvasEl };
}

describe('ステージのドラッグ&ドロップハイライト', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('ステージへのdragenterでハイライトクラス(drag-over)が付与される', () => {
    const { stageEl } = setup();
    stageEl.dispatchEvent(createDragEvent('dragenter'));
    expect(stageEl.classList.contains('drag-over')).toBe(true);
  });

  it('ステージ外(relatedTargetがステージの子孫でない)へのdragleaveでハイライトが解除される', () => {
    const { stageEl } = setup();
    stageEl.dispatchEvent(createDragEvent('dragenter'));

    stageEl.dispatchEvent(createDragEvent('dragleave', { relatedTarget: document.body }));

    expect(stageEl.classList.contains('drag-over')).toBe(false);
  });

  it('ステージ内の子要素(動画)へ移動しただけのdragleaveではハイライトが解除されない', () => {
    const { stageEl, canvasEl } = setup();
    const videoEl = document.createElement('video');
    canvasEl.appendChild(videoEl);

    stageEl.dispatchEvent(createDragEvent('dragenter'));
    // カーソルがステージ内の<video>要素上へ移動したことによるdragleave(relatedTargetはステージの子孫)
    stageEl.dispatchEvent(createDragEvent('dragleave', { relatedTarget: videoEl }));

    expect(stageEl.classList.contains('drag-over')).toBe(true);
  });

  it('動画ファイルのdropで<video>要素が追加され、ハイライトが解除される', () => {
    const { stageEl, canvasEl } = setup();
    stageEl.dispatchEvent(createDragEvent('dragenter'));

    const videoFile = new File([new Uint8Array([0, 0, 0, 0])], 'sample.mp4', { type: 'video/mp4' });
    stageEl.dispatchEvent(createDragEvent('drop', { dataTransfer: { files: [videoFile] } }));

    expect(canvasEl.querySelector('video')).not.toBeNull();
    expect(stageEl.classList.contains('drag-over')).toBe(false);
  });

  it('動画以外のファイルをdropしても<video>要素は追加されない', () => {
    const { stageEl, canvasEl } = setup();
    const textFile = new File(['hello'], 'note.txt', { type: 'text/plain' });

    stageEl.dispatchEvent(createDragEvent('drop', { dataTransfer: { files: [textFile] } }));

    expect(canvasEl.querySelector('video')).toBeNull();
  });

  it('ステージ範囲外(window)へのdropは既定動作が防止される', () => {
    setup();
    const event = createDragEvent('drop', { dataTransfer: { files: [] } });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
