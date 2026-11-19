// Окружение по умолчанию: настоящий backend (npm start, npm run build).
// Заглушки включает конфигурация `stub` (npm run start:stub, npm run build:stub, npm run e2e).
export const environment = {
  apiMode: 'real' as 'real' | 'stub',
};
