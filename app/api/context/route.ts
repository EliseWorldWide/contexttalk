import { getProvider } from '../../../lib/ai';
import { errorResponse, guard, json, readJson } from '../../../lib/server/http';
import { parseContext, parseText } from '../../../lib/server/validate';
import { AIError } from '../../../lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// «Add to context»: структурирует выбранный фрагмент (только явно сказанное).
export async function POST(req: Request) {
  try {
    guard(req);
    const b = await readJson<Record<string, unknown>>(req);
    const text = parseText(b.text, 4000);
    if (!text) throw new AIError('bad_request', 'text required', 400);
    return json(await getProvider().processContext({ text, context: parseContext(b.context) }, req.signal));
  } catch (e) { return errorResponse(e); }
}
