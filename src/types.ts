/** 動画素材のキャンバスへのフィット方式。cover=縦横比維持でキャンバス全体を覆う、contain=縦横比維持で全体を収める、custom=自由配置 */
export type FitMode = 'cover' | 'contain' | 'custom';

/** 動画キャンバス(表示領域)のサイズ設定 */
export interface CanvasConfig {
  width: number;
  height: number;
}

/** キャンバス内に配置する動画レイヤー(素材)1つ分の状態モデル */
export interface VideoLayerModel {
  id: string;
  x: number; // scale=1基準のボックス位置(左上)
  y: number;
  width: number; // fitモード計算結果の幅(px) ※scale適用前
  height: number; // fitモード計算結果の高さ(px) ※scale適用前
  scale: number; // 中心基準の拡大率(既定1)
  fitMode: FitMode;
  naturalWidth: number; // 動画本来の解像度(loadedmetadata取得後にセット)
  naturalHeight: number;

  // 今回UIには出さないが、将来拡張のためモデルには保持
  opacity: number; // 既定1
  trimStart: number; // 再生開始位置(秒) 既定0
  playbackRate: number; // 既定1
  muted: boolean; // 既定false
}
