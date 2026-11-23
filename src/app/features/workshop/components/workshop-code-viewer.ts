import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { WorkshopAlgorithmVersion } from '../data/workshop.models';

export type DslTokenKind = 'keyword' | 'comment' | 'string' | 'number' | 'plain';

export interface DslToken {
  readonly kind: DslTokenKind;
  readonly text: string;
}

export interface DslCodeLine {
  readonly lineNumber: number;
  readonly tokens: readonly DslToken[];
}

const DSL_KEYWORDS = new Set([
  'param',
  'rule',
  'when',
  'then',
  'because',
  'buy',
  'sell',
  'market',
  'limit',
  'and',
  'or',
  'not',
]);

const TOKEN_PATTERN =
  /(#.*$)|("(?:\\.|[^"\\])*")|\b([a-zA-Z_][a-zA-Z0-9_]*)\b|\b(\d+(?:\.\d+)?%?)\b/gm;

export function tokenizeDslLine(line: string): readonly DslToken[] {
  if (!line) {
    return [{ kind: 'plain', text: '' }];
  }
  const tokens: DslToken[] = [];
  let lastIndex = 0;
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'plain', text: line.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ kind: 'comment', text: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ kind: 'string', text: match[2] });
    } else if (match[3] !== undefined) {
      const word = match[3];
      tokens.push({
        kind: DSL_KEYWORDS.has(word) ? 'keyword' : 'plain',
        text: word,
      });
    } else if (match[4] !== undefined) {
      tokens.push({ kind: 'number', text: match[4] });
    }
    lastIndex = TOKEN_PATTERN.lastIndex;
  }
  if (lastIndex < line.length) {
    tokens.push({ kind: 'plain', text: line.slice(lastIndex) });
  }
  return tokens;
}

export function tokenizeDslSource(source: string): readonly DslCodeLine[] {
  return source.split(/\r?\n/).map((line, index) => ({
    lineNumber: index + 1,
    tokens: tokenizeDslLine(line),
  }));
}

@Component({
  selector: 'app-workshop-code-viewer',
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (versions().length > 0) {
      <section class="code-viewer" aria-label="Исходный код версии алгоритма">
        <div class="code-header">
          <div class="code-title-row">
            <h3 class="tui-text_h6">
              Исходный код версии
              @if (activeVersion(); as ver) {
                v{{ ver.version }}
              }
            </h3>
            @if (versions().length > 1) {
              <div class="version-pills" role="group" aria-label="Выбор версии кода">
                @for (ver of versions(); track ver.version) {
                  <button
                    tuiButton
                    type="button"
                    size="xs"
                    [appearance]="activeVersion()?.version === ver.version ? 'primary' : 'outline'"
                    (click)="selectVersion(ver.version)"
                  >
                    v{{ ver.version }}
                  </button>
                }
              </div>
            }
          </div>
          @if (activeSource()) {
            <button tuiButton type="button" size="xs" appearance="outline" (click)="copyCode()">
              {{ copied() ? 'Скопировано' : 'Скопировать код' }}
            </button>
          }
        </div>

        @if (activeSource(); as source) {
          <div class="code-block" role="region" aria-label="Листинг DSL">
            @for (line of lines(); track line.lineNumber) {
              <div class="code-line">
                <span class="line-no" aria-hidden="true">{{ line.lineNumber }}</span>
                <code class="line-content">
                  @for (tok of line.tokens; track $index) {
                    <span [class]="'tok-' + tok.kind">{{ tok.text }}</span>
                  }
                  @if (line.tokens.length === 1 && line.tokens[0].text === '') {
                    <span> </span>
                  }
                </code>
              </div>
            }
          </div>
        } @else {
          <p class="tui-text_body-s muted empty-source">
            Исходный код для выбранной версии недоступен.
          </p>
        }
      </section>
    }
  `,
  styles: `
    .code-viewer {
      border-top: 1px solid var(--tui-border-normal);
      padding-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .code-title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      h3 {
        margin: 0;
      }
    }

    .version-pills {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-wrap: wrap;
    }

    .code-block {
      max-height: 22rem;
      overflow: auto;
      padding: 0.5rem 0;
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-m);
      background: var(--tui-background-neutral-1);
      font-family:
        'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    .code-line {
      display: grid;
      grid-template-columns: 2.5rem minmax(0, 1fr);
      padding: 0 0.75rem 0 0.25rem;
    }

    .line-no {
      user-select: none;
      text-align: right;
      padding-right: 0.75rem;
      color: var(--tui-text-tertiary);
      font-variant-numeric: tabular-nums;
    }

    .line-content {
      font-family: inherit;
      white-space: pre;
      color: var(--tui-text-primary);
    }

    .tok-keyword {
      color: var(--tui-text-action);
      font-weight: 600;
    }

    .tok-string {
      color: var(--tui-text-positive);
    }

    .tok-comment {
      color: var(--tui-text-tertiary);
      font-style: italic;
    }

    .tok-number {
      color: var(--tui-text-warning, var(--tui-text-secondary));
    }

    .muted {
      color: var(--tui-text-secondary);
    }

    .empty-source {
      margin: 0;
    }
  `,
})
export class WorkshopCodeViewer {
  private readonly destroyRef = inject(DestroyRef);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  readonly versions = input<readonly WorkshopAlgorithmVersion[]>([]);
  readonly latestVersion = input<number>(0);

  private readonly selectedVersion = signal<number | null>(null);
  protected readonly copied = signal(false);

  protected readonly activeVersion = computed<WorkshopAlgorithmVersion | null>(() => {
    const list = this.versions();
    if (list.length === 0) {
      return null;
    }
    const chosen = this.selectedVersion();
    if (chosen !== null) {
      const found = list.find((v) => v.version === chosen);
      if (found) {
        return found;
      }
    }
    const latest = this.latestVersion();
    return list.find((v) => v.version === latest) ?? list[0];
  });

  protected readonly activeSource = computed(() => this.activeVersion()?.source ?? null);

  protected readonly lines = computed<readonly DslCodeLine[]>(() => {
    const src = this.activeSource();
    return src ? tokenizeDslSource(src) : [];
  });

  constructor() {
    effect(() => {
      this.versions();
      this.selectedVersion.set(null);
      this.copied.set(false);
    });

    this.destroyRef.onDestroy(() => {
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });
  }

  protected selectVersion(version: number): void {
    this.selectedVersion.set(version);
    this.copied.set(false);
  }

  protected async copyCode(): Promise<void> {
    const src = this.activeSource();
    if (!src) {
      return;
    }
    try {
      await navigator.clipboard?.writeText(src);
      this.copied.set(true);
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
      }
      this.copyTimer = setTimeout(() => {
        this.copied.set(false);
        this.copyTimer = null;
      }, 2000);
    } catch {
      this.copied.set(false);
    }
  }
}
