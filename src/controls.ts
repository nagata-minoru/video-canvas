import { CanvasController } from './canvas';
import { VideoLayer } from './videoLayer';
import { attachDrag } from './drag';
import { formatTime } from './formatTime';
import { CanvasExporter, extensionForMimeType } from './exporter';
import type { CanvasConfig, FitMode } from './types';

/**
 * 画面上の全UIコントロール(キャンバスサイズ・動画追加・Fit・Scale・X/Y・再生系)を取得し、
 * VideoLayer/CanvasControllerへの結線を行う。DOM取得と状態管理・イベント購読をこの関数内に閉じ込める。
 * @param canvasController キャンバスのサイズ管理を行うコントローラ
 * @param deps テスト用の差し替えポイント。createExporterを渡すとCanvasExporterの生成を差し替えられる
 */
export function initControls(
  canvasController: CanvasController,
  deps: { createExporter?: (config: CanvasConfig) => CanvasExporter } = {},
): void {
  const canvasWidthInput = document.getElementById('canvas-width') as HTMLInputElement;
  const canvasHeightInput = document.getElementById('canvas-height') as HTMLInputElement;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const fitModeSelect = document.getElementById('fit-mode') as HTMLSelectElement;
  const scaleRange = document.getElementById('scale-range') as HTMLInputElement;
  const scaleNumber = document.getElementById('scale-number') as HTMLInputElement;
  const posXInput = document.getElementById('pos-x') as HTMLInputElement;
  const posYInput = document.getElementById('pos-y') as HTMLInputElement;
  const playPauseBtn = document.getElementById('play-pause') as HTMLButtonElement;
  const timeDisplay = document.getElementById('time-display') as HTMLSpanElement;
  const seekBar = document.getElementById('seek') as HTMLInputElement;
  const stageEl = document.getElementById('stage') as HTMLElement;
  const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
  const exportCancelBtn = document.getElementById('export-cancel-btn') as HTMLButtonElement;

  const createExporter = deps.createExporter ?? ((config: CanvasConfig) => new CanvasExporter(config));

  /** 現在キャンバスに配置されている動画レイヤー。動画未読み込み時はnull */
  let layer: VideoLayer | null = null;
  /** シークバーをドラッグ操作中かどうか。trueの間はtimeupdateによるシークバー値の上書きを止める */
  let isSeeking = false;
  /** エクスポート処理が進行中かどうか。trueの間はドラッグ&ドロップによる動画差し替えを禁止する */
  let isExporting = false;
  /** 進行中のエクスポートを中断するためのコントローラ。エクスポート中以外はnull */
  let exportAbortController: AbortController | null = null;

  /**
   * layerのモデル値(scale, x, y)をScale/X/Yの各入力欄に反映する。
   * ドラッグ操作やフィットモード変更でモデルが変わった際に呼ばれる(VideoLayer#onModelChange経由)。
   */
  function syncLayerInputs(): void {
    if (!layer) return;
    scaleRange.value = String(layer.model.scale);
    scaleNumber.value = String(layer.model.scale);
    posXInput.value = String(Math.round(layer.model.x));
    posYInput.value = String(Math.round(layer.model.y));
  }

  /**
   * 再生時間表示("mm:ss / mm:ss")を更新する。
   * @param currentSeconds 表示する現在の再生位置(秒)
   */
  function updateTimeDisplay(currentSeconds: number): void {
    const duration = layer?.videoEl.duration ?? 0;
    timeDisplay.textContent = `${formatTime(currentSeconds)} / ${formatTime(duration)}`;
  }

  /** 再生UI(再生ボタン・シークバー・時間表示)を初期状態(停止・0秒)に戻す */
  function resetPlaybackUI(): void {
    playPauseBtn.textContent = '▶';
    seekBar.max = '0';
    seekBar.value = '0';
    updateTimeDisplay(0);
  }

  /**
   * エクスポート中に操作されると録画のハングや座標系のズレを招くコントロール一式の有効/無効を切り替える。
   * @param locked trueで一括disabledにしキャンセルボタンを表示、falseで解除して通常状態に戻す
   */
  function setExportLock(locked: boolean): void {
    fileInput.disabled = locked;
    canvasWidthInput.disabled = locked;
    canvasHeightInput.disabled = locked;
    playPauseBtn.disabled = locked;
    seekBar.disabled = locked;
    exportBtn.disabled = locked || !layer;
    exportCancelBtn.hidden = !locked;
  }

  /**
   * Blobの実際のMIMEタイプ(blob.type)に応じて拡張子(mp4/webm)を切り替えつつ、
   * 日時つきファイル名でダウンロードさせる。
   * @param blob ダウンロードさせる動画データ
   */
  function downloadBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
    const extension = extensionForMimeType(blob.type);
    a.href = url;
    a.download = `video-canvas-export-${timestamp}.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** キャンバス幅入力欄のchangeイベントリスナ。キャンバス幅を更新し、動画レイヤーにも新しいキャンバスサイズを伝える */
  canvasWidthInput.addEventListener('change', () => {
    const size = { width: Number(canvasWidthInput.value), height: canvasController.config.height };
    canvasController.setSize(size.width, size.height);
    layer?.setCanvasSize({ w: size.width, h: size.height });
  });

  /** キャンバス高さ入力欄のchangeイベントリスナ。キャンバス高さを更新し、動画レイヤーにも新しいキャンバスサイズを伝える */
  canvasHeightInput.addEventListener('change', () => {
    const size = { width: canvasController.config.width, height: Number(canvasHeightInput.value) };
    canvasController.setSize(size.width, size.height);
    layer?.setCanvasSize({ w: size.width, h: size.height });
  });

  /**
   * 指定された動画ファイルで既存レイヤーを置き換える。新しいVideoLayerを生成してキャンバスへ追加し、
   * ドラッグ操作・再生系イベントを結線したうえでファイルを読み込む。
   * ファイル選択inputとドラッグ&ドロップの両方から共通で呼び出される。
   * @param file 読み込む動画ファイル
   */
  function loadVideoFile(file: File): void {
    layer?.destroy();

    layer = new VideoLayer({ w: canvasController.config.width, h: canvasController.config.height });
    layer.onModelChange = syncLayerInputs;
    layer.setFitMode(fitModeSelect.value as FitMode);
    canvasController.el.appendChild(layer.videoEl);
    /** 動画要素のドラッグ移動コールバック。ドラッグ量(dx, dy)を現在位置に加算して新しい位置を設定する */
    attachDrag(layer.videoEl, (dx, dy) => {
      if (!layer) return;
      layer.setPosition(layer.model.x + dx, layer.model.y + dy);
    });

    /** loadedmetadataイベントリスナ。動画の総時間が判明したらシークバーの最大値と時間表示を更新する */
    layer.videoEl.addEventListener('loadedmetadata', () => {
      seekBar.max = String(layer!.videoEl.duration);
      updateTimeDisplay(layer!.videoEl.currentTime);
    });
    /** playイベントリスナ。再生ボタンの表示を一時停止アイコンに切り替える */
    layer.videoEl.addEventListener('play', () => (playPauseBtn.textContent = '⏸'));
    /** pauseイベントリスナ。再生ボタンの表示を再生アイコンに切り替える */
    layer.videoEl.addEventListener('pause', () => (playPauseBtn.textContent = '▶'));
    /** endedイベントリスナ。再生終了時に再生ボタンの表示を再生アイコンに戻す */
    layer.videoEl.addEventListener('ended', () => (playPauseBtn.textContent = '▶'));
    /** timeupdateイベントリスナ。シークバー操作中でなければ現在位置に合わせてシークバーと時間表示を更新する */
    layer.videoEl.addEventListener('timeupdate', () => {
      if (isSeeking) return;
      seekBar.value = String(layer!.videoEl.currentTime);
      updateTimeDisplay(layer!.videoEl.currentTime);
    });

    resetPlaybackUI();
    exportBtn.disabled = false;
    layer.loadFile(file);
  }

  /** ファイル選択inputのchangeイベントリスナ。選択された動画ファイルを読み込む */
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    loadVideoFile(file);
  });

  /** ステージ上でのdragoverイベントリスナ。既定のドロップ拒否動作を止め、ドロップを許可する */
  stageEl.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
  });

  /** ステージへのdragenterイベントリスナ。ドラッグ中であることを示すハイライト表示を付与する */
  stageEl.addEventListener('dragenter', (e: DragEvent) => {
    e.preventDefault();
    stageEl.classList.add('drag-over');
  });

  /**
   * ステージからのdragleaveイベントリスナ。ステージ外に出たらハイライト表示を解除する。
   * ステージ内の子要素(動画など)をまたいだ移動でもdragleaveはバブルして発火するため、
   * 移動先(relatedTarget)がステージの子孫であれば「まだステージ内にいる」とみなして無視する。
   */
  stageEl.addEventListener('dragleave', (e: DragEvent) => {
    if (stageEl.contains(e.relatedTarget as Node)) return;
    stageEl.classList.remove('drag-over');
  });

  /**
   * ステージへのdropイベントリスナ。ドロップされた先頭のファイルが動画であれば読み込む。
   * disabled属性と無関係に発火するイベントのため、エクスポート中は先頭で無視する。
   */
  stageEl.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    stageEl.classList.remove('drag-over');
    if (isExporting) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('video/')) return;
    loadVideoFile(file);
  });

  /** ページ全体へのdragoverイベントリスナ。ステージ外へのドロップでブラウザが遷移するのを防ぐ */
  window.addEventListener('dragover', (e: DragEvent) => e.preventDefault());
  /** ページ全体へのdropイベントリスナ。ステージ外へのドロップでブラウザがファイルを開いてしまうのを防ぐ */
  window.addEventListener('drop', (e: DragEvent) => e.preventDefault());

  /** Fitモード選択欄のchangeイベントリスナ。選択されたフィットモードを動画レイヤーに適用する */
  fitModeSelect.addEventListener('change', () => {
    layer?.setFitMode(fitModeSelect.value as FitMode);
  });

  /** Scaleスライダーのinputイベントリスナ。数値入力欄と値を同期しつつ、動画レイヤーの拡大率を更新する */
  scaleRange.addEventListener('input', () => {
    scaleNumber.value = scaleRange.value;
    layer?.setScale(Number(scaleRange.value));
  });
  /** Scale数値入力欄のinputイベントリスナ。スライダーと値を同期しつつ、動画レイヤーの拡大率を更新する */
  scaleNumber.addEventListener('input', () => {
    scaleRange.value = scaleNumber.value;
    layer?.setScale(Number(scaleNumber.value));
  });

  /** X座標入力欄のchangeイベントリスナ。入力された値でレイヤーのX座標のみを更新する(Yは現在値を維持) */
  posXInput.addEventListener('change', () => {
    if (!layer) return;
    layer.setPosition(Number(posXInput.value), layer.model.y);
  });
  /** Y座標入力欄のchangeイベントリスナ。入力された値でレイヤーのY座標のみを更新する(Xは現在値を維持) */
  posYInput.addEventListener('change', () => {
    if (!layer) return;
    layer.setPosition(layer.model.x, Number(posYInput.value));
  });

  /** 再生/一時停止ボタンのclickイベントリスナ。動画レイヤーの再生状態をトグルする */
  playPauseBtn.addEventListener('click', () => {
    layer?.togglePlay();
  });

  /** シークバーのinputイベントリスナ(ドラッグ中)。isSeekingを立てて時間表示だけをプレビュー更新し、動画本体はまだシークしない */
  seekBar.addEventListener('input', () => {
    isSeeking = true;
    updateTimeDisplay(Number(seekBar.value));
  });
  /** シークバーのchangeイベントリスナ(ドラッグ確定時)。動画本体を指定位置へシークし、isSeekingを解除する */
  seekBar.addEventListener('change', () => {
    layer?.seekTo(Number(seekBar.value));
    isSeeking = false;
  });

  /** エクスポートボタンのclickイベントリスナ。現在の演出をMP4(対応環境)またはWebMとして録画しダウンロードさせる */
  exportBtn.addEventListener('click', async () => {
    if (!layer || isExporting) return;
    const activeLayer = layer;

    isExporting = true;
    setExportLock(true);
    exportAbortController = new AbortController();
    const exporter = createExporter(canvasController.config);

    /** エクスポート中のtimeupdateイベントリスナ。エクスポートボタンの文言を進捗表示に更新する */
    const onProgress = () => {
      const current = formatTime(activeLayer.videoEl.currentTime);
      const duration = formatTime(activeLayer.videoEl.duration);
      exportBtn.textContent = `エクスポート中... ${current} / ${duration}`;
    };
    activeLayer.videoEl.addEventListener('timeupdate', onProgress);

    try {
      const blob = await exporter.record(activeLayer.videoEl, () => activeLayer.model, exportAbortController.signal);
      downloadBlob(blob);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        alert(err instanceof Error ? err.message : 'エクスポートに失敗しました');
      }
    } finally {
      activeLayer.videoEl.removeEventListener('timeupdate', onProgress);
      isExporting = false;
      exportAbortController = null;
      exportBtn.textContent = 'エクスポート';
      setExportLock(false);
    }
  });

  /** キャンセルボタンのclickイベントリスナ。進行中のエクスポートを中断する */
  exportCancelBtn.addEventListener('click', () => {
    exportAbortController?.abort();
  });

  resetPlaybackUI();
}
