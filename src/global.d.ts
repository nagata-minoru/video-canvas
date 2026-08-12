/**
 * TypeScript標準のDOM型定義(lib.dom.d.ts)に未収録の HTMLMediaElement.captureStream() を補う。
 * Web標準APIだが型定義生成が追いついていないための補完。存在しないブラウザ(Safari等)もあるためoptionalにする。
 */
interface HTMLMediaElement {
  captureStream?(): MediaStream;
}
