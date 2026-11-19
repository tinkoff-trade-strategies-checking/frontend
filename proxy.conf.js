// Прокси dev-сервера на backend: /api → http://localhost:${BACKEND_PORT:-8080} (локальный стенд, AGENTS.md).
const port = process.env.BACKEND_PORT || '8080';

module.exports = {
  '/api': {
    target: `http://localhost:${port}`,
    secure: false,
    changeOrigin: false,
  },
};
