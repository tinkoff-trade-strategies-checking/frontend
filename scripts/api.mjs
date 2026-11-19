// Копия контракта REST/SSE и генерация TS-клиента (documentation/decisions.md, «Архитектура»).
//   node scripts/api.mjs sync   — скопировать backend/api/openapi.yaml в api/openapi.yaml:
//                                 из ../backend, если он склонирован рядом, иначе с GitHub (ветка main)
//   node scripts/api.mjs check  — копия совпадает с backend на GitHub (main); всегда с GitHub,
//                                 чтобы локально и в CI результат был одинаковым
//   node scripts/api.mjs gen    — сгенерировать клиент в src/app/api (не коммитится)
// Пока нет ни контракта в backend, ни копии, sync/check ничего не делают и завершаются успешно.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const COPY = 'api/openapi.yaml';
const LOCAL = '../backend/api/openapi.yaml';
const REMOTE =
  'https://raw.githubusercontent.com/tinkoff-trade-strategies-checking/backend/main/api/openapi.yaml';

// Концы строк не сравниваем: на Windows рабочая копия backend с CRLF, GitHub отдаёт LF.
const lf = (text) => text.replaceAll('\r\n', '\n');

function fail(message) {
  console.error(message);
  process.exit(1);
}

// Текст контракта с GitHub; null — файла в backend нет (404).
async function fetchRemote() {
  let response;
  try {
    response = await fetch(REMOTE, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    const reason =
      error?.name === 'TimeoutError' ? 'таймаут 15 с' : (error?.cause?.code ?? error?.message);
    fail(`Не удалось скачать ${REMOTE}: ${reason}`);
  }
  if (response.status === 404) return null;
  if (!response.ok) fail(`Не удалось скачать ${REMOTE}: HTTP ${response.status}`);
  return response.text();
}

const command = process.argv[2];
if (command === 'sync') {
  const text = existsSync(LOCAL) ? readFileSync(LOCAL, 'utf8') : await fetchRemote();
  if (text === null) {
    console.warn('В backend пока нет api/openapi.yaml — пропускаю.');
  } else {
    mkdirSync('api', { recursive: true });
    writeFileSync(COPY, text);
    console.warn(`Скопировано в ${COPY}.`);
  }
} else if (command === 'check') {
  const text = await fetchRemote();
  if (text === null) {
    if (existsSync(COPY)) fail(`${COPY} есть, а в backend контракта нет.`);
    console.warn('Ни в backend, ни во frontend нет api/openapi.yaml — пропускаю.');
  } else if (!existsSync(COPY) || lf(readFileSync(COPY, 'utf8')) !== lf(text)) {
    fail(`${COPY} расходится с backend — выполни: npm run api:sync`);
  }
} else if (command === 'gen') {
  if (!existsSync(COPY)) {
    console.warn(`Нет ${COPY} — генерация клиента пропущена.`);
  } else {
    execFileSync('npx', ['ng-openapi-gen', '--config', 'ng-openapi-gen.json'], {
      stdio: 'inherit',
      shell: true,
    });
  }
} else {
  fail('Команда: sync | check | gen');
}
