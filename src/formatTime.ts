/**
 * 秒数を "mm:ss" 形式の文字列に整形する。
 * @param seconds 整形対象の秒数
 * @returns "mm:ss" 形式の文字列。負数やNaN・Infinityなど不正な値の場合は "00:00" を返す
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
