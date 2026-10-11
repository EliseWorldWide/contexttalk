// Нарезка перевода на короткие сегменты, чтобы озвучка начиналась с первого предложения.
export function splitSentences(text: string, minLen = 8): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?。！？…])\s*/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].length < minLen) out[out.length - 1] += (/[\u3000-\u9fff]/.test(p) ? '' : ' ') + p;
    else out.push(p);
  }
  return out.length ? out : text.trim() ? [text.trim()] : [];
}
