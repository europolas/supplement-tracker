/** Compact plain text for previews, never a semantic or AI summarizer. Full text
 * belongs in the detail view. Whitespace is normalized; whole words are preferred,
 * and Unicode code points are never split. No HTML parsing/sanitizing, locale guess,
 * stored data or resources needing cleanup. Render the result with textContent.
 * Contract and examples: ../docs/TEXT.md.
 */
export function compactText(value, { maxWords = 6, maxLength = 80 } = {}) {
  if (!Number.isInteger(maxWords) || maxWords < 1 || !Number.isInteger(maxLength) || maxLength < 2) throw new RangeError('Positive word and character limits required');
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  const words = text.split(' ');
  if (words.length <= maxWords && Array.from(text).length <= maxLength) return text;
  const selected = words.slice(0, maxWords);
  while (selected.length > 1 && Array.from(selected.join(' ')).length > maxLength - 1) selected.pop();
  let result = selected.join(' ');
  const truncated = result !== text || Array.from(result).length > maxLength;
  if (!truncated) return result;
  result = Array.from(result).slice(0, maxLength - 1).join('').replace(/[\s,;:.-]+$/u, '');
  return result + '…';
}
