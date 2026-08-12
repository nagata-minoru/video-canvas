import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasController } from './canvas';
import { initControls } from './controls';
import type { CanvasExporter } from './exporter';
import { CANVAS_PRESETS } from './presets';
import { VideoLayer } from './videoLayer';

/**
 * initControls()が要求するDOM構造(index.htmlの主要要素、プリセット選択欄を含む)を
 * document.bodyへ組み立てる。
 * @returns テストで参照する主要な要素群
 */
function setupDom(): {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  canvasWidthInput: HTMLInputElement;
  canvasHeightInput: HTMLInputElement;
  canvasPresetSelect: HTMLSelectElement;
  exportBtn: HTMLButtonElement;
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
    <span id="time-display"></span>
    <input id="seek" type="range" value="0" />
    <button id="export-btn" type="button" disabled>エクスポート</button>
    <button id="export-cancel-btn" type="button" hidden>キャンセル</button>
    <div id="export-overlay" hidden>
      <p id="export-overlay-text"></p>
    </div>
    <section id="stage">
      <div id="canvas"></div>
    </section>
  `;
  return {
    stageEl: document.getElementById('stage') as HTMLElement,
    canvasEl: document.getElementById('canvas') as HTMLElement,
    canvasWidthInput: document.getElementById('canvas-width') as HTMLInputElement,
    canvasHeightInput: document.getElementById('canvas-height') as HTMLInputElement,
    canvasPresetSelect: document.getElementById('canvas-preset') as HTMLSelectElement,
    exportBtn: document.getElementById('export-btn') as HTMLButtonElement,
  };
}

/** ステージへ動画ファイルをドロップし、動画を読み込ませる */
function dropVideoFile(stageEl: HTMLElement): void {
  const videoFile = new File([new Uint8Array([0, 0, 0, 0])], 'sample.mp4', { type: 'video/mp4' });
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [videoFile] } });
  stageEl.dispatchEvent(event);
}

describe('キャンバスサイズプリセット', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('プレースホルダー含めCANVAS_PRESETSの件数+1のoptionが生成され、ラベルが一致する', () => {
    const { canvasEl, canvasPresetSelect } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);

    expect(canvasPresetSelect.options.length).toBe(CANVAS_PRESETS.length + 1);
    expect(canvasPresetSelect.options[0]?.value).toBe('');
    CANVAS_PRESETS.forEach((preset, index) => {
      expect(canvasPresetSelect.options[index + 1]?.textContent).toBe(preset.label);
    });
  });

  it('初期表示ではプレースホルダーが選択されている', () => {
    const { canvasEl, canvasPresetSelect } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);

    expect(canvasPresetSelect.selectedIndex).toBe(0);
    expect(canvasPresetSelect.value).toBe('');
  });

  it('プリセット選択で幅・高さ入力欄が更新される', () => {
    const { canvasEl, canvasWidthInput, canvasHeightInput, canvasPresetSelect } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);

    const targetIndex = CANVAS_PRESETS.findIndex((p) => p.size.width === 1080 && p.size.height === 1920);
    canvasPresetSelect.value = String(targetIndex);
    canvasPresetSelect.dispatchEvent(new Event('change'));

    expect(canvasWidthInput.value).toBe('1080');
    expect(canvasHeightInput.value).toBe('1920');
  });

  it('プリセット選択でcanvasController.configとDOMスタイルが更新される', () => {
    const { canvasEl, canvasPresetSelect } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);

    const targetIndex = CANVAS_PRESETS.findIndex((p) => p.size.width === 1080 && p.size.height === 1350);
    canvasPresetSelect.value = String(targetIndex);
    canvasPresetSelect.dispatchEvent(new Event('change'));

    expect(canvasController.config).toEqual({ width: 1080, height: 1350 });
    expect(canvasEl.style.width).toBe('1080px');
    expect(canvasEl.style.height).toBe('1350px');
  });

  it('動画読み込み済みの状態でプリセットを選択すると、VideoLayer#setCanvasSizeが新サイズで呼ばれる', () => {
    const { stageEl, canvasEl, canvasPresetSelect } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);
    dropVideoFile(stageEl);

    const setCanvasSizeSpy = vi.spyOn(VideoLayer.prototype, 'setCanvasSize');
    const targetIndex = CANVAS_PRESETS.findIndex((p) => p.size.width === 608 && p.size.height === 1080);
    canvasPresetSelect.value = String(targetIndex);
    canvasPresetSelect.dispatchEvent(new Event('change'));

    expect(setCanvasSizeSpy).toHaveBeenCalledWith({ w: 608, h: 1080 });
  });

  it('エクスポート中はプリセット選択欄がdisabledになる', () => {
    const { stageEl, canvasEl, canvasPresetSelect } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    const fakeExporter = { record: () => new Promise<Blob>(() => {}) } as unknown as CanvasExporter;
    initControls(canvasController, { createExporter: () => fakeExporter });
    dropVideoFile(stageEl);

    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    exportBtn.click();

    expect(canvasPresetSelect.disabled).toBe(true);
  });

  it('幅入力欄を手動変更してもプリセット選択欄の選択状態は変化しない', () => {
    const { canvasEl, canvasWidthInput, canvasPresetSelect } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);

    canvasWidthInput.value = '900';
    canvasWidthInput.dispatchEvent(new Event('change'));

    expect(canvasPresetSelect.value).toBe('');
    expect(canvasPresetSelect.selectedIndex).toBe(0);
  });
});
