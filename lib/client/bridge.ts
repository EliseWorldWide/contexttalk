import { ContextEngine } from '../context/engine.ts';
import { LANGUAGES, languageInfo } from '../languages.ts';
import { REFERENCE_SECONDS } from '../voice/voice-service.ts';
import { api, ApiError } from './api.ts';
import { classifyMicError } from './capture.ts';
import { ConversationController } from './conversation.ts';
import { VoiceRecorder } from './recorder.ts';

// Мост между TypeScript-ядром и существующим интерфейсом (public/contexttalk.js).
const ContextTalk = {
  ContextEngine, ConversationController, VoiceRecorder, api, ApiError, classifyMicError,
  LANGUAGES, languageInfo, REFERENCE_SECONDS,
};
export type ContextTalkBridge = typeof ContextTalk;
declare global { interface Window { ContextTalk?: ContextTalkBridge } }
if (typeof window !== 'undefined') window.ContextTalk = ContextTalk;
export default ContextTalk;
