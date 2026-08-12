/** キャンバス内での配置ボックス(左上座標と幅・高さ) */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 幅・高さのみを表すサイズ */
export interface Size {
  w: number;
  h: number;
}

/**
 * COVER方式の配置ボックスを計算する。動画の縦横比を維持したまま、はみ出す方向を許容してキャンバス全体を覆うスケールを求める。
 * @param natural 動画本来のサイズ
 * @param canvas キャンバスのサイズ
 * @returns キャンバス内での配置ボックス(x, y, width, height)。はみ出した部分は呼び出し側のoverflow:hiddenでクロップされる想定
 */
export function computeCoverBox(natural: Size, canvas: Size): Box {
  const scale = Math.max(canvas.w / natural.w, canvas.h / natural.h);
  const width = natural.w * scale;
  const height = natural.h * scale;
  return { x: (canvas.w - width) / 2, y: (canvas.h - height) / 2, width, height };
}

/**
 * CONTAIN方式の配置ボックスを計算する。動画の縦横比を維持したまま、全体がキャンバス内に収まるスケールを求める。
 * @param natural 動画本来のサイズ
 * @param canvas キャンバスのサイズ
 * @returns キャンバス内での配置ボックス(x, y, width, height)。縦横比が異なる場合は余白(レターボックス)が生じる
 */
export function computeContainBox(natural: Size, canvas: Size): Box {
  const scale = Math.min(canvas.w / natural.w, canvas.h / natural.h);
  const width = natural.w * scale;
  const height = natural.h * scale;
  return { x: (canvas.w - width) / 2, y: (canvas.h - height) / 2, width, height };
}

/**
 * CUSTOM方式の配置ボックスを計算する。動画を原寸のままキャンバス中央に配置する初期値を返す(以降はユーザー操作で自由に調整される想定)。
 * @param natural 動画本来のサイズ
 * @param canvas キャンバスのサイズ
 * @returns 原寸でキャンバス中央に配置したボックス(x, y, width, height)
 */
export function computeCustomBox(natural: Size, canvas: Size): Box {
  return {
    x: (canvas.w - natural.w) / 2,
    y: (canvas.h - natural.h) / 2,
    width: natural.w,
    height: natural.h,
  };
}

/**
 * 指定されたフィットモードに応じた配置ボックスの計算関数を呼び分ける。
 * @param mode フィットモード('cover' | 'contain' | 'custom')
 * @param natural 動画本来のサイズ
 * @param canvas キャンバスのサイズ
 * @returns キャンバス内での配置ボックス(x, y, width, height)
 */
export function computeFitBox(mode: 'cover' | 'contain' | 'custom', natural: Size, canvas: Size): Box {
  switch (mode) {
    case 'cover':
      return computeCoverBox(natural, canvas);
    case 'contain':
      return computeContainBox(natural, canvas);
    case 'custom':
      return computeCustomBox(natural, canvas);
  }
}
