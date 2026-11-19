# frontend

Веб-клиент проекта «Т-Инвестиции: тренажёр и лаборатория стратегий»: арена (слепой плеер и заявки), мастерская алгоритмов, отчёт и разбор расхождений. Angular 22 + Taiga UI 5.

Продукт — `../documentation` (требования, инварианты, юзкейсы, `decisions.md` «Архитектура»). Процесс, общие стандарты и скиллы — `../home` (`workflow.md`, `standards.md`).

## Команды

Node 22 LTS (`>=22.22.3`, этого требует Angular 22 CLI), npm 11 (`packageManager`; npm 10.9 падает на peer-зависимостях Taiga UI — `npx -y npm@11.21.2 …`).

```sh
npx -y npm@11.21.2 install   # зависимости
npm start                    # генерация клиента API + dev-сервер на настоящем backend (прокси /api → localhost:8080, proxy.conf.json), http://localhost:4200
npm run start:stub           # то же на заглушках, без backend (и без входа)
npm run lint                 # ESLint (angular-eslint)
npm run format               # Prettier — исправить формат; format:check — проверить
npm test                     # генерация клиента API + юнит-тесты (Vitest через @angular/build:unit-test), один прогон
npm run e2e                  # проверка типов + сквозные тесты Playwright на заглушках (start:stub; локально — системный Chrome, в CI — chromium; e2e только против dev-сервера (window.ng))
npm run build                # генерация клиента API + сборка в dist/ (настоящий API)
npm run build:stub           # сборка на заглушках (демо pak-ui.vercel.app)
npm run check                # всё, что проверяет CI: формат, линтер, сверка OpenAPI, тесты, сборка
npm run api:sync             # скопировать контракт в api/openapi.yaml: из ../backend, если он рядом, иначе с GitHub (main)
npm run api:check            # копия совпадает с backend на GitHub (main) — как в CI
```

CI (`.github/workflows/ci.yml`): формат, линтер, сверка копии OpenAPI с `backend` (GitHub, `main`), тесты, сборка — на PR и `main`; джобы `e2e` и `invariants` (ссылки `documentation/invariants.md` на тесты frontend и core — `check-invariants.py`) обязательны в ruleset `main`; `pr-size` — размер PR в режиме наблюдения, только предупреждение (общий workflow из `.github`).

## Структура

- `src/app/app.ts`, `app.html` — оболочка: `tui-root`, навигация, `router-outlet`.
- `src/app/app.routes.ts` — ленивые маршруты разделов; все, кроме `/login`, закрыты `authGuard`.
- `src/environments/` — режим данных: `environment.ts` (`apiMode: 'real'`, по умолчанию) и `environment.stub.ts` (`'stub'`); подменяются конфигурациями `stub` и `development-stub` в `angular.json` (юнит-тесты идут в `development-stub`). Реализации портов — `src/app/api-impls.ts` (настоящие), в `stub`-конфигурациях его подменяет `api-impls.stub.ts`, поэтому заглушки запуска и истории в боевой бандл не попадают; страницы берут `*_API_IMPL` оттуда. Разделы, ещё не подключённые к API, в настоящем режиме закрыты: `core/real-features.ts` (`REAL_FEATURES`, `featureGuard` ведёт на `/history`); каждая часть frontend#8 включает свои. Тесты подменяют `STUB_MODE`.
- `src/app/core/` — сквозное: `http-interceptors.ts` (cookie, повтор при `CSRF_INVALID`, 401 → `/login`), `session-events.ts` (SSE поверх `fetch` с `Last-Event-ID` из снимка; 400/401/403/404 — поток закрыт окончательно, иначе переподключение с последнего события), `idempotency.ts` (`Idempotency-Key` на команду, повтор при обрыве сети с тем же ключом), `api-problem.ts` (разбор `application/problem+json`, ветвление по `code`, тексты ошибок), `auth/` (`AuthService`: `GET /me` даёт профиль и CSRF-cookie; `authGuard`), `api-mode.ts`.
- `src/app/features/login/` — страница входа (`/login`).
- `src/app/features/<раздел>/` — фичи: `launch`, `arena`, `replay`, `workshop`, `report`. Всё, что относится к разделу, — в его папке.
  - `features/launch/` — экран «Новая сессия» (`/new`): `launch-page.*`, `launch.store.ts`, `launch.format.ts`, `data/` (`LaunchApi`, `HttpLaunchApi` над сгенерированным клиентом, `StubLaunchApi`, модели и коды отказов).
  - `features/arena/` — экран арены: `arena-page.*` (композиция, подтверждение завершения и режим только чтения), `arena.store.ts` (Signals-состояние; таймер плеера только у заглушек, при серверном времени — команды плеера и поток событий: номера событий подряд, пропуск или устаревший снимок — перечитать снимок), `arena.format.ts` (форматирование слепого режима), `data/` (`ArenaApi`, `HttpArenaApi` — время ведёт сервер: команды плеера и поток SSE, `StubArenaApi` — шаги по таймеру клиента, `arena.mappers.ts` — ответы API → модели экрана, модели), `components/` (`arena-player`, `arena-chart` над `lightweight-charts`, `arena-order-ticket`, `arena-orders-panel`, `arena-portfolio-panel`).
  - `features/replay/` — экран воспроизведения прошедшей сессии (`/replay/:id`, поддержка `?step=N`): `replay-page.*`, `replay.store.ts` (адаптер только для чтения поверх `ArenaPage`), `data/` (`ReplayApi`, `HttpReplayApi` — курсор у клиента: снимок, затем приращения `fromStep`, `StubReplayApi`, модели).
  - `features/workshop/` — экран «Мастерская» (`/workshop`, каталог алгоритмов и карточка с неизменяемыми версиями INV-5): `workshop-page.*`, `workshop.store.ts` (сортировка, фильтры, поиск, пагинация, выбор до 5 алгоритмов в сравнение, защита от гонки запросов), `workshop.format.ts`, `data/` (`WorkshopApi`, `StubWorkshopApi`, модели).
  - `features/report/` — экран отчёта (`/report/:id`, вкладки метрик, расхождений, обратной проверки и сделок): `report-page.*`, `report.store.ts`, `report.format.ts`, `data/` (`ReportApi`, `HttpReportApi` — подписи сравнения и действия расхождений собирает клиент, `StubReportApi`, модели; пока отчёт `BUILDING`, стор опрашивает его раз в 2 с; выгрузка XLSX/CSV — ссылка на `GET /sessions/{id}/report/export`), `components/` (`report-equity-chart`, `report-underwater-chart` над `lightweight-charts`).
  - `features/history/` — экран «История» (`/history`): `history-page.*`, `history.store.ts` (фильтры, пагинация, защита от гонки запросов), `history.format.ts`, `data/` (`HistoryApi`, `HttpHistoryApi`, `StubHistoryApi` — данные согласованы с заглушками арены и отчёта). Незавершённая слепая запись — отдельная ветка union `HistoryEntry` без бумаг, периода, названия и итога (INV-7), стор дополнительно маскирует лишние поля.
- `src/app/shared/` — общие компоненты и утилиты, когда понадобятся двум и более фичам (`stub-session-registry.ts` — реестр запущенных и завершённых сессий для согласования заглушек).
- `src/app/api/` — TS-клиент API, генерирует `ng-openapi-gen` из `api/openapi.yaml` при сборке; **не коммитится, не правится руками**.
- `api/openapi.yaml` — копия контракта из `backend`, обновляется только `npm run api:sync`.
- `scripts/api.mjs` — синхронизация, сверка и генерация клиента.

## Стандарты

Общие — `../home/standards.md`. Для frontend:

- Компоненты standalone, `ChangeDetectionStrategy.OnPush`, шаблоны — новый control flow (`@if`, `@for`). Проверяет ESLint.
- Состояние — Signals (`signal`, `computed`, `input`, `output`); RxJS — только для потоков (SSE, HTTP) на границе, в шаблон — через сигналы.
- TypeScript strict, без `any` (ESLint).
- HTTP — только через сгенерированный клиент из `src/app/api` (`Api.invoke(fn, params)`); ошибки разбираем по `code` (`core/api-problem.ts`), не по тексту и не по статусу; эндпоинта нет в OpenAPI — сначала он появляется в `backend/api/openapi.yaml` (contract-first).
- UI — компоненты Taiga UI; свои стили — через CSS-переменные Taiga (`--tui-*`), без жёстких цветов.
- Графики свечей и капитала — `lightweight-charts`; простые диаграммы — Taiga Charts.
- Тексты интерфейса — по-русски; имена в коде — по-английски.
- Юнит-тесты — рядом с кодом (`*.spec.ts`), Vitest; сквозные — Playwright (`frontend#1`).

## Критично

- **INV-1, INV-7.** На арене не показывать и не запрашивать будущее: не предзагружать свечи вперёд, не дорисовывать график дальше последней полученной свечи. В слепом режиме клиент не знает название, тикер и даты — если их нет в ответе API, не пытаться их получить.
- **INV-2.** Заявка отправляется с номером последней свечи, которую видел пользователь.
- **INV-6.** Деньги и метрики приходят с сервера и только отображаются; в клиенте их не пересчитывать. В слепом режиме суммы — в % от капитала.
- **INV-8.** После F5 или обрыва SSE состояние арены восстанавливается с сервера, а не из локального кеша.

## Когда обновлять документы

Общая таблица — `../home/workflow.md`, «Когда обновлять документы». Для frontend: новая команда или скрипт → «Команды»; новая фича, общий слой, папка → «Структура»; новая библиотека → «Стандарты» и `decisions.md` «Архитектура».
