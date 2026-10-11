import type { ErrorCode } from "./types.ts";

export class AIError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, message: string, status = 500) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = status;
  }
}

// Сообщения для пользователя (ru). Клиент показывает их вместе с кнопкой «Повторить».
export const USER_MESSAGES: Record<ErrorCode, string> = {
  not_configured: "Сервис перевода не настроен: на сервере нет GEMINI_API_KEY.",
  auth: "Gemini отклонил ключ доступа. Проверьте GEMINI_API_KEY.",
  rate_limited: "Слишком много запросов. Подождите немного и повторите.",
  network: "Не удалось подключиться к AI. Проверь интернет-соединение.",
  upstream: "AI сейчас недоступен. Повторите через несколько секунд.",
  bad_request: "Не удалось обработать запрос.",
  language_not_selected: "Язык речи не входит в выбранные языки. Добавьте его в настройках.",
  bad_model_output: "AI вернул непонятный ответ. Повторите попытку.",
  consent_required: "Нужно подтвердить согласие на использование голоса.",
  voice_rejected: "Google не принял запись голоса. Перезапишите образец и фразу согласия заново, подряд и на одном микрофоне.",
  forbidden: "Запрос отклонён.",
  too_large: "Запись слишком длинная.",
  unsupported: "Эта возможность не поддерживается выбранным AI-провайдером.",
};
