import { env, models } from '../../../lib/ai/gemini';
import { json } from '../../../lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Проверка настройки без раскрытия значений: ключ есть/нет, какие модели используются.
export function GET() {
  return json({ ok: true, provider: env('AI_PROVIDER') ?? 'gemini', geminiKeyConfigured: !!env('GEMINI_API_KEY'), models: models() });
}
