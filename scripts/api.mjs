// Копия контракта REST/SSE и генерация TS-клиента (documentation/decisions.md, «Архитектура»).
//   node scripts/api.mjs sync   — скопировать backend/api/openapi.yaml в api/openapi.yaml
//                                 (из ../backend, если склонирован рядом, иначе с GitHub, ветка main)
//   node scripts/api.mjs check  — копия совпадает с backend (для CI)
//   node scripts/api.mjs gen    — сгенерировать клиент в src/app/api (не коммитится)
// Пока в backend нет api/openapi.yaml, все команды ничего не делают и завершаются успешно.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const COPY = 'api/openapi.yaml';
const LOCAL = '../backend/api/openapi.yaml';
const REMOTE =
  'https://raw.githubusercontent.com/tinkoff-trade-strategies-checking/backend/main/api/openapi.yaml';

async function source() {
  if (existsSync(LOCAL)) return readFileSync(LOCAL, 'utf8');
  const response = await fetch(REMOTE);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`не удалось скачать ${REMOTE}: ${response.status}`);
  return response.text();
}

const command = process.argv[2];
if (command === 'sync' || command === 'check') {
  const text = await source();
  if (text === null) {
    console.warn('В backend пока нет api/openapi.yaml — пропускаю.');
  } else if (command === 'sync') {
    mkdirSync('api', { recursive: true });
    writeFileSync(COPY, text);
    console.warn(`Скопировано в ${COPY}.`);
  } else if (!existsSync(COPY) || readFileSync(COPY, 'utf8') !== text) {
    console.error(`${COPY} расходится с backend — выполни: npm run api:sync`);
    process.exit(1);
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
  console.error('Команда: sync | check | gen');
  process.exit(1);
}
