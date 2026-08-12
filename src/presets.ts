import type { CanvasConfig } from './types';

/** キャンバスサイズプリセット1件の定義 */
export interface CanvasPreset {
  label: string;
  size: CanvasConfig;
}

/** キャンバスサイズのプリセット一覧(縦画面向け)。いずれもheight > widthの縦長サイズ */
export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { label: '608×1080', size: { width: 608, height: 1080 } },
  { label: '1080×1920(フルHD縦 9:16)', size: { width: 1080, height: 1920 } },
  { label: '1080×1350(Instagram縦長 4:5)', size: { width: 1080, height: 1350 } },
];
