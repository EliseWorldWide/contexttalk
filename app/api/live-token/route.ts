import { getProvider } from '../../../lib/ai';
import { errorResponse, guard, json } from '../../../lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Выдаёт браузеру одноразовый временный токен Live API. GEMINI_API_KEY наружу не уходит.
export async function POST(req: Request) {
  try {
    guard(req, { weight: 5 });
    return json(await getProvider().realtimeSession());
  } catch (e) { return errorResponse(e); }
}
