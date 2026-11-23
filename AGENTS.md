# frontend

Веб-клиент платформы «Честная проверка»: тренажёр ручной торговли (арена со слепым плеером и заявками), мастерская алгоритмов, отчёт с вердиктом и разбором расхождений. Angular 22 + Taiga UI 5.

Продукт — `../documentation` (требования, инварианты, юзкейсы, `decisions.md` «Архитектура»). Процесс, общие стандарты и скиллы — `../home` (`workflow.md`, `standards.md`).

## Команды

Node 22 LTS (`>=22.22.3`, этого требует Angular 22 CLI), npm 11 (`packageManager`; npm 10.9 падает на peer-зависимостях Taiga UI — `npx -y npm@11.21.2 …`).

```sh
npx -y npm@11.21.2 install   # зависимости
npm start                    # генерация клиента API + dev-сервер на настоящем backend (прокси /api → localhost:8080, proxy.conf.json), http://localhost:4200
npm run start:local          # настоящий режим против локального backend (прокси /api → localhost:${BACKEND_PORT:-8080}, proxy.conf.js)
npm run start:stub           # то же на заглушках, без backend (и без входа)
npm run lint                 # ESLint (angular-eslint)
npm run format               # Prettier — исправить формат; format:check — проверить
npm test                     # генерация клиента API + юнит-тесты (Vitest через @angular/build:unit-test), один прогон
npm run e2e                  # проверка типов + сквозные тесты Playwright на заглушках (start:stub; локально — системный Chrome, в CI — chromium; e2e только против dev-сервера (window.ng))
npm run e2e:real             # сквозной smoke-набор Playwright против реального backend (e2e/real-smoke.spec.ts, playwright.real.config.ts; E2E_REAL_BASE_URL, E2E_EMAIL, E2E_PASSWORD)
npm run build                # генерация клиента API + сборка в dist/ (настоящий API)
npm run build:stub           # сборка на заглушках (демо pak-ui.vercel.app)
npm run check                # всё, что проверяет CI: формат, линтер, сверка OpenAPI, тесты, сборка
npm run api:sync             # скопировать контракт в api/openapi.yaml: из ../backend, если он рядом, иначе с GitHub (main)
npm run api:check            # копия совпадает с backend на GitHub (main) — как в CI
```

CI (`.github/workflows/ci.yml`): формат, линтер, сверка копии OpenAPI с `backend` (GitHub, `main`), тесты, сборка — на PR и `main`; джобы `e2e` и `invariants` (ссылки `documentation/invariants.md` на тесты frontend и core — `check-invariants.py`) обязательны в ruleset `main`; `pr-size` — размер PR в режиме наблюдения, только предупреждение (общий workflow из `.github`). Отдельный workflow `.github/workflows/e2e-real.yml` (по изменениям `e2e/real-smoke.spec.ts`, `playwright.real.config.ts`, `.github/workflows/e2e-real.yml` и `workflow_dispatch`) поднимает полный Docker-стек `caddy` + `frontend` + `backend` + `core` (`simulation-worker`) с тестовым снапшотом и гоняет `npm run e2e:real`.

## Структура

- `src/app/app.ts`, `app.html` — оболочка: `tui-root`, навигация, `router-outlet`.
- `src/app/app.routes.ts` — ленивые маршруты разделов; все, кроме `/login`, закрыты `authGuard`.
- `src/environments/` — режим данных: `environment.ts` (`apiMode: 'real'`, по умолчанию) и `environment.stub.ts` (`'stub'`); подменяются конфигурациями `stub` и `development-stub` в `angular.json` (юнит-тесты идут в `development-stub`). Реализации портов — `src/app/api-impls.ts` (настоящие, в том числе `WORKSHOP_API_IMPL` и `RUNS_API_IMPL`), в `stub`-конфигурациях его подменяет `api-impls.stub.ts`, поэтому заглушки в боевой бандл не попадают; страницы берут `*_API_IMPL` оттуда. Разделы `arena`, `report`, `replay` подключены к реальному API (`core/real-features.ts`, `REAL_FEATURES` — все `true`, `featureGuard` ведёт на `/history`); Мастерская (`/workshop`), прогоны (`/runs/:id`, `/runs/:id/report`), запуск (`/new`) и история (`/history`) открыты без `featureGuard`. Тесты подменяют `STUB_MODE`.
- `src/app/core/` — сквозное: `http-interceptors.ts` (cookie, повтор при `CSRF_INVALID`, 401 → `/login`), `session-events.ts` (SSE поверх `fetch` с `Last-Event-ID` из снимка; 400/401/403/404 — поток закрыт окончательно, иначе переподключение с последнего события), `idempotency.ts` (`Idempotency-Key` на команду, повтор при обрыве сети с тем же ключом), `api-problem.ts` (разбор `application/problem+json`, ветвление по `code`, тексты ошибок), `auth/` (`AuthService`: `GET /me` даёт профиль и CSRF-cookie; `authGuard`), `theme.service.ts` (`ThemeService`: переключение светлой/тёмной кобальтовой темы «Честная проверка» и хранение в `localStorage`), `api-mode.ts`.
- `src/app/features/login/` — страница входа (`/login`).
- `src/app/features/<раздел>/` — фичи: `launch`, `arena`, `replay`, `workshop`, `runs`, `report`, `history`. Всё, что относится к разделу, — в его папке.
  - `features/launch/` — экран «Новая сессия» (`/new`): шаги цикла, быстрые пресеты (`LAUNCH_PRESETS`) и сворачиваемая настройка параметров, `launch-page.*`, `launch.store.ts`, `launch.format.ts`, `data/` (`LaunchApi`, `HttpLaunchApi` над сгенерированным клиентом, `StubLaunchApi`, модели и коды отказов).
  - `features/arena/` — экран арены: `arena-page.*` (композиция, сворачиваемый гид `ttsc.arenaGuideDismissed`, подтверждение завершения и режим только чтения), `arena.store.ts` (Signals-состояние; таймер плеера только у заглушек, при серверном времени — команды плеера и поток событий: номера событий подряд, пропуск или устаревший снимок — перечитать снимок), `arena.format.ts` (форматирование слепого режима), `data/` (`ArenaApi`, `HttpArenaApi` — время ведёт сервер: команды плеера и поток SSE, `StubArenaApi` — шаги по таймеру клиента, `arena.mappers.ts` — ответы API → модели экрана, модели), `components/` (`arena-player`, `arena-chart` над `lightweight-charts`, `arena-order-ticket`, `arena-orders-panel`, `arena-portfolio-panel`).
  - `features/replay/` — экран воспроизведения прошедшей сессии (`/replay/:id`, поддержка `?step=N`): `replay-page.*`, `replay.store.ts` (адаптер только для чтения поверх `ArenaPage`), `data/` (`ReplayApi`, `HttpReplayApi` — курсор у клиента: снимок, затем приращения `fromStep`, `StubReplayApi`, модели).
  - `features/workshop/` — экран «Мастерская» (`/workshop`, вкладки «Каталог сообщества» и «Мои алгоритмы», карточка с неизменяемыми версиями INV-5, просмотром исходного кода версий и мягким удалением своих алгоритмов, редактор черновика DSL с `check`/`fix` и публикацией, запуск прогона) и сравнение выбранных алгоритмов (`/workshop/compare`: метрики последнего прогона и наложение кривых): `workshop-page.*`, `workshop.store.ts` (сортировка, фильтры, поиск, пагинация, сравнение до 5 алгоритмов, защита от гонки запросов), `workshop-compare-page.*`, `workshop-compare.store.ts`, `workshop.format.ts`, `components/` (`workshop-code-viewer`, `workshop-draft-editor`, `workshop-run-form`, `workshop-compare-chart`), `data/` (`WorkshopApi`, `HttpWorkshopApi` через `WORKSHOP_API_IMPL`, `StubWorkshopApi`, `apply-text-edits.ts`, модели).
  - `features/runs/` — экраны прогона алгоритма (`/runs/:id`: прогресс по SSE, повтор прогона INV-4) и отчёта прогона (`/runs/:id/report`: findings, сделки, заявки с `ruleName` и `because`, выгрузка XLSX/CSV): `run-page.*`, `run.store.ts`, `run-report-page.*`, `run-report.store.ts`, `data/` (`RunsApi`, `HttpRunsApi` через `RUNS_API_IMPL`, `StubRunsApi`, модели); сквозные тесты — `e2e/runs.spec.ts`.
  - `features/report/` — экран отчёта (`/report/:id`, Hero-карточка вердикта, вкладки метрик, расхождений, обратной проверки и сделок): `report-page.*`, `report.store.ts`, `report.format.ts`, `data/` (`ReportApi`, `HttpReportApi` — подписи сравнения и действия расхождений собирает клиент, `StubReportApi`, модели; пока отчёт `BUILDING`, стор опрашивает его раз в 2 с; выгрузка XLSX/CSV — `ReportExportService`: `GET /sessions/{id}/report/export` blob-ом, файл сохраняет `FILE_SAVER`), `components/` (`report-equity-chart`, `report-underwater-chart` над `lightweight-charts`).
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
- UI — компоненты Taiga UI; свои стили — через CSS-переменные Taiga (`--tui-*`) и спокойной кобальтовой дизайн-системы «Честная проверка» (60/30/10, нейтральные secondary-кнопки) в `src/styles.less`, без жёстких цветов; локальные шрифты `@fontsource/manrope` и `@fontsource/jetbrains-mono` (без внешних CDN).
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

## Локальный стенд

Настоящий режим против backend на своей машине: поднять backend и его зависимости скриптом `../backend/deploy/dev-up.sh` (подробности — `../backend/README.md`), затем `npm run start:local`. Прокси (`proxy.conf.js`) отправляет `/api` на `http://localhost:8080`; другой порт — переменная `BACKEND_PORT` (`BACKEND_PORT=18080 npm run start:local`). Вход — пользователем из сидов backend; без backend — `npm run start:stub`.
