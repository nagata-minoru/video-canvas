/**
 * 指定したHTML要素にPointer Events APIによるドラッグ操作を付与する。
 * マウス・タッチ・ペンを統一的に扱い、setPointerCaptureにより要素外へ移動しても追従する。
 * @param target ドラッグ対象のHTML要素
 * @param onMove ドラッグ中に直前位置からの差分(dx, dy)を受け取るコールバック
 */
export function attachDrag(target: HTMLElement, onMove: (dx: number, dy: number) => void): void {
  /** ポインタ押下時のイベントリスナ。ドラッグ開始位置を記録し、ポインタをキャプチャしてmove/upの購読を開始する */
  target.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault();
    let lastX = e.clientX;
    let lastY = e.clientY;
    target.setPointerCapture(e.pointerId);

    /** ポインタ移動時のハンドラ。直前位置との差分を計算してonMoveへ通知し、直前位置を更新する */
    const onPointerMove = (ev: PointerEvent) => {
      onMove(ev.clientX - lastX, ev.clientY - lastY);
      lastX = ev.clientX;
      lastY = ev.clientY;
    };
    /** ポインタ解放時のハンドラ。ポインタキャプチャを解除し、move/upのイベントリスナを取り除く */
    const onPointerUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
    };
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
  });
}
