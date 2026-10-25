import type { VideoLayerModel, FitMode } from './types';
import { computeFitBox, type Size } from './fit';

/** キャンバス内に配置される動画素材1つ分の状態(VideoLayerModel)と<video>要素への描画を管理するクラス */
export class VideoLayer {
  readonly videoEl: HTMLVideoElement;
  /** キャンバス外へのはみ出し部分をグレースケールで表示するための背面用<video>要素。常時ミュートで前景と同期再生する */
  readonly bgVideoEl: HTMLVideoElement;
  model: VideoLayerModel;
  /** モデル(位置・サイズ・スケール等)が更新され再描画されるたびに呼ばれるコールバック。UI側の数値入力同期に使う */
  onModelChange: (() => void) | null = null;

  private canvasSize: Size;
  private objectUrl: string | null = null;

  /**
   * @param canvasSize 配置先キャンバスの現在のサイズ
   */
  constructor(canvasSize: Size) {
    this.canvasSize = canvasSize;
    this.videoEl = document.createElement('video');
    this.videoEl.playsInline = true;

    this.bgVideoEl = document.createElement('video');
    this.bgVideoEl.playsInline = true;
    this.bgVideoEl.muted = true;

    this.model = {
      id: crypto.randomUUID(),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scale: 1,
      fitMode: 'cover',
      naturalWidth: 0,
      naturalHeight: 0,
      opacity: 1,
      trimStart: 0,
      playbackRate: 1,
      muted: true,
    };

    this.videoEl.style.opacity = String(this.model.opacity);
    this.videoEl.playbackRate = this.model.playbackRate;
    this.videoEl.muted = this.model.muted;

    this.bgVideoEl.style.opacity = String(this.model.opacity);
    this.bgVideoEl.playbackRate = this.model.playbackRate;
  }

  /**
   * 動画ファイルを読み込み、<video>要素のsrcにObject URLとして設定する。
   * 既存のObject URLがあれば解放してから差し替える。メタデータ取得後に自動でフィット計算を行う。
   * @param file 読み込むローカル動画ファイル
   */
  loadFile(file: File): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.videoEl.src = this.objectUrl;
    this.bgVideoEl.src = this.objectUrl;
    /** loadedmetadataイベントのハンドラ。動画本来の解像度を取得し、開始位置を適用してフィットを再計算する */
    this.videoEl.addEventListener(
      'loadedmetadata',
      () => {
        this.model.naturalWidth = this.videoEl.videoWidth;
        this.model.naturalHeight = this.videoEl.videoHeight;
        if (this.model.trimStart > 0) {
          this.videoEl.currentTime = this.model.trimStart;
          this.bgVideoEl.currentTime = this.model.trimStart;
        }
        this.resetToFit();
      },
      { once: true },
    );
  }

  /**
   * 配置先キャンバスのサイズを更新する。動画のメタデータが読み込み済みであればフィットを再計算する。
   * @param size 新しいキャンバスサイズ
   */
  setCanvasSize(size: Size): void {
    this.canvasSize = size;
    if (this.model.naturalWidth > 0) this.resetToFit();
  }

  /**
   * フィットモードを変更し、フィットを再計算する。
   * @param mode 新しいフィットモード('cover' | 'contain' | 'custom')
   */
  setFitMode(mode: FitMode): void {
    this.model.fitMode = mode;
    this.resetToFit();
  }

  /**
   * 動画素材の位置(scale=1基準のボックス左上座標)を設定する。
   * @param x 新しいX座標(px)
   * @param y 新しいY座標(px)
   */
  setPosition(x: number, y: number): void {
    this.model.x = x;
    this.model.y = y;
    this.render();
  }

  /**
   * 動画素材の拡大率を設定する。transform-origin: centerにより中心を軸にスケールされる。
   * @param scale 新しい拡大率
   */
  setScale(scale: number): void {
    this.model.scale = scale;
    this.render();
  }

  /**
   * 前景動画の音声ミュート状態を設定する(背面用<video>は音声二重再生防止のため常時ミュート固定で対象外)。
   * @param muted trueでミュート、falseでミュート解除
   */
  setMuted(muted: boolean): void {
    this.model.muted = muted;
    this.videoEl.muted = muted;
  }

  /** 動画が一時停止中なら再生、再生中なら一時停止する(背面用<video>も同期して再生・一時停止する) */
  togglePlay(): void {
    if (this.videoEl.paused) {
      this.videoEl.play();
      this.bgVideoEl.play();
    } else {
      this.videoEl.pause();
      this.bgVideoEl.pause();
    }
  }

  /**
   * 動画の再生位置を指定秒数へ移動する(背面用<video>も同じ位置へ移動する)。
   * @param seconds 移動先の再生位置(秒)
   */
  seekTo(seconds: number): void {
    this.videoEl.currentTime = seconds;
    this.bgVideoEl.currentTime = seconds;
  }

  /** Object URLを解放し、前景・背面の<video>要素をDOMから取り除く(動画差し替え・破棄時に呼ぶ) */
  destroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.videoEl.remove();
    this.bgVideoEl.remove();
  }

  /**
   * 現在のfitModeに基づいて配置ボックスを再計算し、位置・サイズ・拡大率をそのモードの初期値にリセットする。
   * 動画のnaturalWidth/naturalHeightが未取得(0)の場合は何もしない。
   */
  private resetToFit(): void {
    if (this.model.naturalWidth === 0) return;
    const box = computeFitBox(
      this.model.fitMode,
      { w: this.model.naturalWidth, h: this.model.naturalHeight },
      this.canvasSize,
    );
    this.model.x = box.x;
    this.model.y = box.y;
    this.model.width = box.width;
    this.model.height = box.height;
    this.model.scale = 1;
    this.render();
  }

  /** モデルの現在値(位置・サイズ・拡大率)を前景・背面両方の<video>要素のスタイルへ反映し、onModelChangeコールバックを呼び出す */
  private render(): void {
    const { x, y, width, height, scale } = this.model;
    for (const el of [this.videoEl, this.bgVideoEl]) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.transform = `scale(${scale})`;
    }
    this.onModelChange?.();
  }
}
