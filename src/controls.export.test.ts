import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasController } from './canvas';
import { initControls } from './controls';
import type { CanvasExporter } from './exporter';
import type { CanvasConfig } from './types';

/**
 * initControls()が要求するDOM構造(index.htmlの主要要素、エクスポート関連ボタンを含む)を
 * document.bodyへ組み立てる。
 * @returns テストで参照する主要な要素群
 */
function setupDom(): {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  exportBtn: HTMLButtonElement;
  exportCancelBtn: HTMLButtonElement;
  fileInput: HTMLInputElement;
  canvasWidthInput: HTMLInputElement;
  canvasHeightInput: HTMLInputElement;
  playPauseBtn: HTMLButtonElement;
  seekBar: HTMLInputElement;
} {
  document.body.innerHTML = `
    <input id="canvas-width" type="number" value="1080" />
    <input id="canvas-height" type="number" value="608" />
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
    exportBtn: document.getElementById('export-btn') as HTMLButtonElement,
    exportCancelBtn: document.getElementById('export-cancel-btn') as HTMLButtonElement,
    fileInput: document.getElementById('file-input') as HTMLInputElement,
    canvasWidthInput: document.getElementById('canvas-width') as HTMLInputElement,
    canvasHeightInput: document.getElementById('canvas-height') as HTMLInputElement,
    playPauseBtn: document.getElementById('play-pause') as HTMLButtonElement,
    seekBar: document.getElementById('seek') as HTMLInputElement,
  };
}

/**
 * record()の解決/拒否を外部から制御できるフェイクのCanvasExporterを生成する。
 * jsdomではcaptureStream/MediaRecorderが動かないため、実際のCanvasExporterの代わりに
 * initControls()のDIポイント(createExporter)へ差し込んでUI状態遷移のみを検証する。
 * @returns initControlsへ渡すcreateExporter関数と、record()のPromiseを外部操作するための関数群
 */
function createFakeExporter(): {
  createExporter: (config: CanvasConfig) => CanvasExporter;
  resolveRecord: (blob: Blob) => void;
  rejectRecord: (err: unknown) => void;
  getSignal: () => AbortSignal | undefined;
} {
  let resolveFn: (blob: Blob) => void = () => {};
  let rejectFn: (err: unknown) => void = () => {};
  let capturedSignal: AbortSignal | undefined;

  const fakeExporter = {
    record: (_videoEl: HTMLVideoElement, _getBox: () => unknown, signal?: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<Blob>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      });
    },
  } as unknown as CanvasExporter;

  return {
    createExporter: () => fakeExporter,
    resolveRecord: (blob) => resolveFn(blob),
    rejectRecord: (err) => rejectFn(err),
    getSignal: () => capturedSignal,
  };
}

/** ステージへ動画ファイルをドロップし、動画を読み込ませる(exportBtnを有効化するための共通手順) */
function dropVideoFile(stageEl: HTMLElement): void {
  const videoFile = new File([new Uint8Array([0, 0, 0, 0])], 'sample.mp4', { type: 'video/mp4' });
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [videoFile] } });
  stageEl.dispatchEvent(event);
}

/** Promiseの解決を待つマイクロタスク・マクロタスクをフラッシュする */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('エクスポート機能', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('alert', vi.fn());
  });

  it('動画未読み込みの間はエクスポートボタンが無効', () => {
    const { canvasEl, exportBtn } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);

    expect(exportBtn.disabled).toBe(true);
  });

  it('動画読み込み後はエクスポートボタンが有効になる', () => {
    const { stageEl, canvasEl, exportBtn } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    initControls(canvasController);

    dropVideoFile(stageEl);

    expect(exportBtn.disabled).toBe(false);
  });

  it('エクスポート開始で関連コントロールが一括disabledになり、キャンセルボタンが表示される', () => {
    const {
      stageEl,
      canvasEl,
      exportBtn,
      exportCancelBtn,
      fileInput,
      canvasWidthInput,
      canvasHeightInput,
      playPauseBtn,
      seekBar,
    } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    const fake = createFakeExporter();
    initControls(canvasController, { createExporter: fake.createExporter });
    dropVideoFile(stageEl);

    exportBtn.click();

    expect(fileInput.disabled).toBe(true);
    expect(canvasWidthInput.disabled).toBe(true);
    expect(canvasHeightInput.disabled).toBe(true);
    expect(playPauseBtn.disabled).toBe(true);
    expect(seekBar.disabled).toBe(true);
    expect(exportBtn.disabled).toBe(true);
    expect(exportCancelBtn.hidden).toBe(false);
  });

  it('エクスポート完了(resolve)後はロックが解除され、ダウンロードが発生する', async () => {
    const { stageEl, canvasEl, exportBtn, exportCancelBtn, fileInput } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    const fake = createFakeExporter();
    initControls(canvasController, { createExporter: fake.createExporter });
    dropVideoFile(stageEl);

    exportBtn.click();
    fake.resolveRecord(new Blob(['dummy'], { type: 'video/webm' }));
    await flushAsync();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(fileInput.disabled).toBe(false);
    expect(exportBtn.disabled).toBe(false);
    expect(exportBtn.textContent).toBe('エクスポート');
    expect(exportCancelBtn.hidden).toBe(true);
  });

  it('エクスポート失敗(reject、AbortError以外)時はalertが呼ばれ、ロックが解除される', async () => {
    const { stageEl, canvasEl, exportBtn, fileInput } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    const fake = createFakeExporter();
    initControls(canvasController, { createExporter: fake.createExporter });
    dropVideoFile(stageEl);

    exportBtn.click();
    fake.rejectRecord(new Error('テストエラー'));
    await flushAsync();

    expect(alert).toHaveBeenCalledWith('テストエラー');
    expect(fileInput.disabled).toBe(false);
    expect(exportBtn.disabled).toBe(false);
  });

  it('AbortErrorでのreject時はalertが呼ばれない', async () => {
    const { stageEl, canvasEl, exportBtn, fileInput } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    const fake = createFakeExporter();
    initControls(canvasController, { createExporter: fake.createExporter });
    dropVideoFile(stageEl);

    exportBtn.click();
    fake.rejectRecord(new DOMException('中断', 'AbortError'));
    await flushAsync();

    expect(alert).not.toHaveBeenCalled();
    expect(fileInput.disabled).toBe(false);
  });

  it('キャンセルボタンのクリックでrecord()に渡されたsignalがabortされる', () => {
    const { stageEl, canvasEl, exportBtn, exportCancelBtn } = setupDom();
    const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });
    const fake = createFakeExporter();
    initControls(canvasController, { createExporter: fake.createExporter });
    dropVideoFile(stageEl);

    exportBtn.click();
    exportCancelBtn.click();

    expect(fake.getSignal()?.aborted).toBe(true);
  });
});
