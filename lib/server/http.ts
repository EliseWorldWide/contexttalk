import { AIError, USER_MESSAGES } from '../errors.ts';
import { env } from '../ai/gemini.ts';

// Лёгкая защита публичных API-маршрутов: тот же origin, лимит размера и запросов на IP.
// На serverless лимитер работает в пределах одного инстанса — это «best effort», а не замена WAF.
const hits = new Map<string, { n: number; reset: number }>();
const WINDOW_MS = 60_000;

export function guard(req: Request, opts: { maxBytes?: number; weight?: number } = {}): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).host; } catch { /* invalid */ }
    if (!host || oh !== host) throw new AIError('forbidden', 'Cross-origin request rejected', 403);
  }
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > (opts.maxBytes ?? 6_000_000)) throw new AIError('too_large', 'Request too large', 413);
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const limit = Number(env('RATE_LIMIT_PER_MINUTE') ?? 90);
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.reset < now) hits.set(ip, { n: opts.weight ?? 1, reset: now + WINDOW_MS });
  else if ((cur.n += opts.weight ?? 1) > limit) throw new AIError('rate_limited', 'Too many requests', 429);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function errorResponse(e: unknown): Response {
  if (e instanceof AIError) return json({ error: { code: e.code, message: USER_MESSAGES[e.code], detail: e.status >= 500 ? undefined : e.message } }, e.status);
  console.error('[contexttalk] unexpected error', e instanceof Error ? e.message : e);
  return json({ error: { code: 'upstream', message: USER_MESSAGES.upstream } }, 500);
}

export async function readJson<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new AIError('bad_request', 'Invalid JSON body', 400); }
}
