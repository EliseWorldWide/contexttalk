import { AIError } from '../errors.ts';
import { env, GeminiProvider } from './gemini.ts';
import type { AIProvider } from './provider.ts';

let cached: AIProvider | null = null;

// AI_PROVIDER=gemini (по умолчанию). Для OpenAI достаточно реализовать AIProvider и добавить ветку здесь:
// UI, Context Engine, история и голосовые профили не меняются.
export function getProvider(): AIProvider {
  if (cached) return cached;
  const name = (env('AI_PROVIDER') ?? 'gemini').toLowerCase();
  if (name === 'gemini') return (cached = new GeminiProvider());
  throw new AIError('unsupported', `AI_PROVIDER="${name}" is not implemented`, 501);
}
