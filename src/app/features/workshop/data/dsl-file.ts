export const DSL_MAX_FILE_BYTES = 65536;
export const DSL_MAX_NAME_LENGTH = 80;
export const DSL_FILE_ACCEPT = '.dsl,.txt,text/plain';

export type DslFileReadResult =
  | {
      readonly ok: true;
      readonly source: string;
      readonly suggestedName: string;
      readonly fileName: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export function extractStrategyNameFromFilename(fileName: string): string {
  const baseName = (fileName.split(/[\\/]/).pop() ?? '').trim();
  return baseName
    .replace(/\.(dsl|txt)$/i, '')
    .trim()
    .slice(0, DSL_MAX_NAME_LENGTH)
    .trim();
}

export function buildDslDownloadFilename(draftName: string): string {
  const cleaned = draftName
    .trim()
    .replace(/\.(dsl|txt)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.+$/g, '');
  return `${cleaned || 'strategy'}.dsl`;
}

export function normalizeDslText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Не удалось прочитать файл.'));
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsArrayBuffer(file);
  });
}

export async function readAndValidateDslFile(file: File): Promise<DslFileReadResult> {
  if (file.size === 0) {
    return {
      ok: false,
      error: 'Файл пустой. Выберите непустой файл со стратегией DSL.',
    };
  }

  if (file.size > DSL_MAX_FILE_BYTES) {
    return {
      ok: false,
      error: 'Файл превышает лимит 64 КиБ (65 536 байт), допустимый для стратегии DSL.',
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFileBytes(file);
  } catch {
    return {
      ok: false,
      error: 'Не удалось прочитать выбранный файл.',
    };
  }

  if (bytes.byteLength === 0) {
    return {
      ok: false,
      error: 'Файл пустой. Выберите непустой файл со стратегией DSL.',
    };
  }

  if (bytes.byteLength > DSL_MAX_FILE_BYTES) {
    return {
      ok: false,
      error: 'Файл превышает лимит 64 КиБ (65 536 байт), допустимый для стратегии DSL.',
    };
  }

  if (bytes.includes(0)) {
    return {
      ok: false,
      error: 'Файл содержит бинарные данные и не может быть загружен как код DSL.',
    };
  }

  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      error: 'Файл не является корректным текстовым файлом в кодировке UTF-8.',
    };
  }

  const source = normalizeDslText(decoded);
  if (!source.trim()) {
    return {
      ok: false,
      error: 'Файл пустой. Выберите непустой файл со стратегией DSL.',
    };
  }

  return {
    ok: true,
    source,
    suggestedName: extractStrategyNameFromFilename(file.name),
    fileName: file.name,
  };
}
