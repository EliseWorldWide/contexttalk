# ContextTalk: архитектура

```
Client (UI: public/contexttalk.js + мост lib/client/bridge.ts)
  ↓  ConversationController (lib/client/conversation.ts): состояния idle · listening · processing · understanding · translating · speaking · interrupted · error
Microphone → AudioWorklet (pcm-worklet.js) → VAD (lib/client/vad.ts)
  ↓
Realtime Transport: WebSocket (wss) с одноразовым токеном  ← /api/live-token
  ↓
Gemini Live (gemini-3.8-live): транскрипт входящей речи
  ↓  (конец реплики: пауза 1.4 с по VAD; аудио реплики + транскрипт)
Context Engine (lib/context/engine.ts): участники, факты (CONFIRMED / INFERENCE / UNCERTAIN), сущности, отношения, неразрешённые ссылки, история языков
  ↓
Translation (/api/translate → AIProvider.translate → gemini-3.8-flash): определение языка среди выбранных, маршрут, перевод, режимы Natural / Literal / Contextual
  ↓
Voice Service (lib/voice/voice-service.ts): выбор голоса того, кому принадлежит целевой язык
  ↓
TTS (/api/tts → gemini-3.8-flash-tts, replicated voice или prebuilt)
  ↓
Audio Playback (lib/client/player.ts): сегменты по предложениям, мгновенный stop при перебивании
```

## Слои и границы

| Слой | Файлы | Зависит от Gemini |
|---|---|---|
| UI | `public/contexttalk.js`, `app/markup.ts`, `app/globals.css` | нет |
| Оркестрация | `lib/client/conversation.ts` | нет (через `api.ts`) |
| Context Engine | `lib/context/engine.ts` | нет |
| Языки, типы, ошибки | `lib/languages.ts`, `lib/types.ts`, `lib/errors.ts` | нет |
| Логика перевода (промпт, валидация, маршрут) | `lib/ai/translate-flow.ts` | нет (модель подставляется) |
| AIProvider | `lib/ai/provider.ts` (интерфейс), `lib/ai/gemini.ts`, `lib/ai/index.ts` | только `gemini.ts` |
| Голоса | `lib/voice/voice-service.ts` | через `AIProvider` |
| API-маршруты | `app/api/*` | через `AIProvider` |

`AI_PROVIDER=gemini` выбирает провайдера в `lib/ai/index.ts`. Чтобы добавить OpenAI: реализовать `AIProvider` (`OpenAIProvider`) и добавить ветку в `getProvider()`. UI, Context Engine, модель беседы, голосовые профили и история не меняются.

## Языки и маршрутизация

- Выбранные пользователем языки (Настройки → Языки разговора) — единственные возможные. Язык вне списка не принимается (`resolveLanguage`, `restrictToSelected`).
- Язык определяет Gemini по аудио реплики, выбранным языкам, контексту и языку предыдущего говорящего; латиница в транскрипте не означает английский («ni hao» — китайский).
- `ContextEngine.resolveRoute`: язык USER → перевод на язык PARTNER; иначе → на язык USER. Если языки совпадают или язык третий, говорящий помечается как неточный. Сервер проверяет направление и делает одну повторную попытку.

## Context Engine и «никаких выдуманных фактов»

- Факт CONFIRMED принимается от модели только если цитата-основание дословно есть в реплике (`acceptModelFacts`), иначе он понижается до INFERENCE.
- «Add to context» — единственный способ вручную создать CONFIRMED.
- Для местоимений 他/她/它 в промпт передаются подтверждённые факты и пол; если пол неизвестен, перевод нейтральный, а неоднозначность попадает в `unresolvedReferences`.
- Новая беседа (`reset()`) создаёт новый `conversationId` и стирает факты, реплики и ссылки; участники, языки и голоса сохраняются.
- Сервер не хранит состояние: клиент присылает ограниченный снимок беседы.

## Перебивание

Микрофон открыт и во время озвучки. VAD пока говорит AI требует более громкого и долгого (≥240 мс) голоса. `barge_in` → `player.stop()` (звук обрывается сразу) → `interrupted` (250 мс) → `listening`, новая реплика обрабатывается как обычно. Идущий запрос отменяется счётчиком `run`.

## Голосовые профили и репликация

`VoiceService.createVoiceProfile`: образец 10–30 с + запись фразы согласия (на языке профиля) → `POST /v1beta/voices` (тип `replicated`, модель TTS) → `voice_…` (или `voicekey_…`, если `GEMINI_VOICE_STORE=false`). Сохраняются только `voiceId`, имя, язык, дата, статус согласия. Записи не хранятся ни на сервере, ни на клиенте после отправки. Удаление: `DELETE /v1beta/voices/{id}` (для stateless-ключа достаточно забыть его). Без согласия создание отклоняется до обращения к Google.

Озвучка: перевод на язык USER → голос USER, перевод на язык PARTNER → голос PARTNER. Без профиля у сторон разные встроенные голоса (Kore / Puck).

## Безопасность

- `GEMINI_API_KEY` только в серверных маршрутах (заголовок `x-goog-api-key`), в клиентский бандл не попадает. Браузеру выдаётся одноразовый токен Live (1 сессия, 30 мин, новое подключение в течение 1 мин), привязанный к модели.
- `/api/*`: проверка origin, лимит размера, лимит запросов на IP (в пределах инстанса), валидация входа. Это не замена авторизации: публичный деплой стоит закрыть Deployment Protection.
- Заголовки: `Permissions-Policy: microphone=(self)`, `X-Frame-Options: SAMEORIGIN`, HSTS (`next.config.mjs`).

## Что требует проверки на вашем ключе

1. Формат setup-сообщения Live для `gemini-3.8-live` (`lib/ai/gemini.ts → liveSetup`): собран по текущей документации. Если WebSocket закрывается сразу после открытия, поправьте только эту функцию.
2. Создание токена через `@google/genai` (`authTokens.create`): тип поля `liveConnectConstraints` зависит от версии SDK.
3. Voices API (бета): сообщалось о HTTP 500 при несовпадении голоса образца и согласия; решается перезаписью обоих файлов подряд на одном микрофоне.
4. Качество определения языка и местоимений зависит от модели; тесты проверяют логику вокруг модели (с подставным ответом), а не саму модель. Для живой проверки используйте `npm run test:live`.
