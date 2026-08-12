import type { Box } from './fit';
import { computeCenterScaledBox } from './fit';
import type { CanvasConfig } from './types';

/** 書き出しに使うMIMEタイプ候補。優先順に並べる。
 *  対応ブラウザ(Chrome・Safari)ではMP4(H.264+AAC)を優先し、非対応環境ではWebM(VP9/VP8+Opus)にフォールバックする */
export const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/**
 * 候補のMIMEタイプを優先順に試し、MediaRecorderがサポートする最初の1つを返す。
 * @param candidates 優先順に並んだMIMEタイプ候補
 * @param isSupported サポート判定関数(既定はMediaRecorder.isTypeSupported。テスト時は差し替え可能)
 * @returns サポートされているMIMEタイプ。全滅時はnull
 */
export function pickSupportedMimeType(
  candidates: readonly string[],
  isSupported: (type: string) => boolean = (type) => MediaRecorder.isTypeSupported(type),
): string | null {
  return candidates.find((candidate) => isSupported(candidate)) ?? null;
}

/**
 * MIMEタイプ文字列から、ダウンロードファイルに付与する拡張子を決定する。
 * blob.type には record() で実際に選ばれたMIMEタイプがそのまま反映される。
 * @param mimeType 判定対象のMIMEタイプ文字列(例: 'video/mp4;codecs=avc1,mp4a.40.2')
 * @returns 'mp4' または 'webm'(video/mp4系以外は既定でwebm)
 */
export function extensionForMimeType(mimeType: string): 'mp4' | 'webm' {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

/** キャンバス上の動画演出をMP4(対応環境)またはWebM(音声つき)として録画・書き出すクラス */
export class CanvasExporter {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  /**
   * @param config 録画用キャンバスの物理サイズ(録画対象の表示キャンバスと同じサイズを指定する)
   */
  constructor(config: CanvasConfig) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D描画コンテキストの取得に失敗しました');
    this.ctx = ctx;
  }

  /**
   * 動画レイヤーの現在の演出(位置・サイズ・拡大率)をリアルタイムに反映しながらMP4(対応環境)またはWebMとして録画する。
   * 動画を最初から最後まで実時間で再生し直すため、動画の長さと同じだけ時間がかかる。
   * @param videoEl 録画元の<video>要素(再生とキャンバス描画の両方に使う)
   * @param getBox 現在のフレームで使う配置ボックス(scale適用前のx,y,width,height)とscaleを返すコールバック
   * @param signal 呼び出し側から中断するためのAbortSignal(キャンセル用)
   * @returns 録画完了後にBlob(MP4またはWebM)を解決するPromise。非対応環境やエラー・中断時はreject
   */
  record(videoEl: HTMLVideoElement, getBox: () => Box & { scale: number }, signal?: AbortSignal): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (typeof videoEl.captureStream !== 'function' || typeof this.canvas.captureStream !== 'function') {
        reject(new Error('このブラウザはエクスポートに対応していません'));
        return;
      }

      const mimeType = pickSupportedMimeType(MIME_CANDIDATES);
      if (!mimeType) {
        reject(new Error('このブラウザで書き出し可能な動画形式が見つかりませんでした'));
        return;
      }

      const canvasStream = this.canvas.captureStream(30);
      const audioTracks = videoEl.captureStream().getAudioTracks();
      audioTracks.forEach((track) => canvasStream.addTrack(track));

      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 8_000_000 });
      const chunks: BlobPart[] = [];
      let rafId = 0;
      let settled = false;

      /** 現在のvideoElフレームを黒背景の上にキャンバスへ描画し、次フレームの描画を予約する */
      const drawFrame = (): void => {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const { scale, ...box } = getBox();
        const scaledBox = computeCenterScaledBox(box, scale);
        this.ctx.drawImage(videoEl, scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);
        rafId = requestAnimationFrame(drawFrame);
      };

      /** 録画終了時の後始末(描画ループ停止・イベント購読解除)をまとめて行う */
      const cleanup = (): void => {
        cancelAnimationFrame(rafId);
        videoEl.removeEventListener('ended', onEnded);
        videoEl.removeEventListener('error', onError);
        signal?.removeEventListener('abort', onAbort);
      };

      /** 動画の再生終了イベントのハンドラ。描画を止めてMediaRecorderを停止し、Blob確定(onstop)を待つ */
      const onEnded = (): void => {
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
      };

      /** 動画のエラーイベントのハンドラ。録画を中止しエラーでrejectする */
      const onError = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(new Error('動画の再生中にエラーが発生しました'));
      };

      /** 呼び出し側からの中断シグナルのハンドラ。再生と録画を止めてAbortErrorでrejectする */
      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        videoEl.pause();
        reject(new DOMException('エクスポートがキャンセルされました', 'AbortError'));
      };

      /** MediaRecorderが生成したデータチャンクを蓄積する */
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      /** MediaRecorder自体のエラーイベントのハンドラ */
      recorder.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('録画中にエラーが発生しました'));
      };
      /** 録画停止完了時のハンドラ。蓄積したチャンクからBlobを組み立ててresolveする */
      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        resolve(new Blob(chunks, { type: mimeType }));
      };

      videoEl.addEventListener('ended', onEnded, { once: true });
      videoEl.addEventListener('error', onError, { once: true });
      signal?.addEventListener('abort', onAbort, { once: true });

      videoEl.currentTime = 0;
      videoEl
        .play()
        .then(() => {
          recorder.start();
          drawFrame();
        })
        .catch((err: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }
}
