import { getProvider } from '../../../../lib/ai';
import { errorResponse, guard, json } from '../../../../lib/server/http';
import { VoiceService } from '../../../../lib/voice/voice-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    guard(req);
    return json(await new VoiceService(getProvider()).getVoiceProfile((await params).id, req.signal));
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    guard(req);
    await new VoiceService(getProvider()).deleteVoiceProfile({ voiceId: (await params).id, storage: 'stateful' }, req.signal);
    return json({ deleted: true });
  } catch (e) { return errorResponse(e); }
}
