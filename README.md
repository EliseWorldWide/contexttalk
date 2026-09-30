# ContextTalk

AI-переводчик для живого разговора. Next.js (App Router) + TypeScript.
Интерфейс и логика прототипа перенесены без изменений: разметка — `app/markup.ts`, стили — `app/globals.css`, логика — `public/contexttalk.js`.

## Требования

- Node.js 18.18 или новее (рекомендуется 20 LTS)
- npm

## Локальный запуск

```bash
npm install
npm run dev
```

Откройте http://localhost:3000. Адрес `localhost` считается безопасным контекстом, поэтому микрофон работает и без HTTPS.

Для проверки с телефона по локальной сети нужен HTTPS (браузеры не дают доступ к микрофону по обычному `http://192.168...`). Проще всего проверять на задеплоенной версии (см. ниже).

## Проверки

```bash
npm run typecheck   # TypeScript
npm run build       # production-сборка
```

Автотестов в проекте нет.

## Production (свой сервер)

```bash
npm install
npm run build
npm run start       # порт 3000; для другого порта: PORT=8080 npm run start
```

Сервер должен стоять за HTTPS (nginx, Caddy, Cloudflare и т. п.). Без HTTPS браузер заблокирует микрофон.

## Deployment на Vercel

1. Загрузите проект в GitHub/GitLab/Bitbucket.
2. На https://vercel.com/new выберите репозиторий. Vercel сам определит Next.js, менять команды не нужно
   (Build: `next build`, Output: по умолчанию).
3. Нажмите Deploy. HTTPS включается автоматически.

Через CLI:

```bash
npm i -g vercel
vercel          # предпросмотр
vercel --prod   # продакшен
```

Переменные окружения не требуются.

После деплоя откройте адрес `https://<ваш-проект>.vercel.app` **напрямую в Safari или Chrome**, не внутри превью Claude.

## Микрофон

- Используется стандартный `navigator.mediaDevices.getUserMedia({ audio: true })`. Запрос идёт по нажатию на сферу.
- В `next.config.mjs` заданы заголовки `Permissions-Policy: microphone=(self)`, `X-Frame-Options: SAMEORIGIN` и HSTS.
- Ошибки разбираются по стандартным именам: `NotAllowedError` (нет разрешения), `NotFoundError` (нет микрофона), `NotReadableError` (занят). Есть кнопка «Повторить» (запрашивает доступ заново) и переход к текстовому вводу.
- Текстовый ввод работает независимо от микрофона.

### Ограничения

- Распознавание речи использует Web Speech API. Он есть в Chrome, Edge и Safari, но не в Firefox. Chrome и Safari отправляют аудио на свои серверы распознавания, поэтому нужна сеть.
- На iPhone сразу после проверки доступа микрофонный поток закрывается, чтобы не конфликтовать с распознаванием, поэтому сфера не реагирует на громкость.
- Голоса озвучки (Милена, Мэй Цзя, Тин Тин) есть не во всех браузерах и системах. Если голоса нет, используется системный голос для языка перевода.
- Перевод пока mock: словарь из 14 фраз (`PB` в `public/contexttalk.js`). Реальный переводчик подключается через `TranslationProvider`.

## Структура

```
app/layout.tsx       шрифт (next/font), metadata, viewport
app/page.tsx         монтирует разметку и запускает скрипт
app/markup.ts        разметка интерфейса
app/globals.css      стили
public/contexttalk.js  логика: провайдеры, пайплайн, история, настройки
next.config.mjs      заголовки безопасности
```
