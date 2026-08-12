import type { CanvasConfig } from './types';

/** 動画キャンバス(ルートDOM要素)のサイズを管理し、DOMへ反映するコントローラ */
export class CanvasController {
  readonly el: HTMLElement;
  config: CanvasConfig;

  /**
   * @param el キャンバスのルートDOM要素
   * @param config 初期のキャンバスサイズ設定
   */
  constructor(el: HTMLElement, config: CanvasConfig) {
    this.el = el;
    this.config = config;
    this.render();
  }

  /**
   * キャンバスサイズを変更し、DOMへ反映する。
   * @param width 新しい幅(px)
   * @param height 新しい高さ(px)
   */
  setSize(width: number, height: number): void {
    this.config = { width, height };
    this.render();
  }

  /** 現在のconfigの値をもとに、ルートDOM要素のwidth/heightスタイルを更新する */
  private render(): void {
    this.el.style.width = `${this.config.width}px`;
    this.el.style.height = `${this.config.height}px`;
  }
}
