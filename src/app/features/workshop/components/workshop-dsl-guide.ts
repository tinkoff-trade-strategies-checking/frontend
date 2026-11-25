import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import {
  DSL_ACTION_ROWS,
  DSL_CANDLE_PATTERN_FUNCTIONS,
  DSL_COMMON_MISTAKES,
  DSL_CROSSBAR_FUNCTIONS,
  DSL_DIAGNOSTICS_TABLE,
  DSL_EXECUTION_RULES,
  DSL_GUIDE_EXAMPLES,
  DSL_GUIDE_TABS,
  DSL_LEVEL_TREND_FUNCTIONS,
  DSL_LIMIT_ROWS,
  DSL_OPERATOR_ROWS,
  DSL_PORTFOLIO_ROWS,
  DSL_QUICKSTART_BREAKDOWN,
  DSL_QUICKSTART_CODE,
  DSL_SERIES_ROWS,
  DSL_STATEFUL_FUNCTIONS,
  DSL_STATELESS_FUNCTIONS,
  DSL_STRUCTURE_FUNCTIONS,
  DslGuideExample,
  DslGuideFunctionItem,
  DslGuideTabId,
} from '../data/dsl-guide.data';
import { DslCodeLine, tokenizeDslSource } from './workshop-code-viewer';

interface TokenizedExample extends DslGuideExample {
  readonly lines: readonly DslCodeLine[];
}

const TOKENIZED_QUICKSTART: readonly DslCodeLine[] = tokenizeDslSource(DSL_QUICKSTART_CODE);
const TOKENIZED_EXAMPLES: readonly TokenizedExample[] = DSL_GUIDE_EXAMPLES.map((example) => ({
  ...example,
  lines: tokenizeDslSource(example.code),
}));

function matchesQuery(item: DslGuideFunctionItem, query: string): boolean {
  if (!query) {
    return true;
  }
  return (
    item.signature.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
  );
}

@Component({
  selector: 'app-workshop-dsl-guide',
  imports: [FormsModule, TuiBadge, TuiButton, TuiInput, TuiNotification, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-dsl-guide.html',
  styleUrl: './workshop-dsl-guide.less',
})
export class WorkshopDslGuide {
  private readonly destroyRef = inject(DestroyRef);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  readonly canInsert = input<boolean>(false);
  readonly closed = output<void>();
  readonly insertCode = output<string>();

  protected readonly tabs = DSL_GUIDE_TABS;
  protected readonly activeTab = signal<DslGuideTabId>('start');
  protected readonly copiedId = signal<string | null>(null);
  protected readonly referenceQuery = signal('');

  protected readonly quickstartCode = DSL_QUICKSTART_CODE;
  protected readonly quickstartLines = TOKENIZED_QUICKSTART;
  protected readonly quickstartBreakdown = DSL_QUICKSTART_BREAKDOWN;
  protected readonly executionRules = DSL_EXECUTION_RULES;
  protected readonly actionRows = DSL_ACTION_ROWS;
  protected readonly operatorRows = DSL_OPERATOR_ROWS;
  protected readonly limitRows = DSL_LIMIT_ROWS;
  protected readonly seriesRows = DSL_SERIES_ROWS;
  protected readonly portfolioRows = DSL_PORTFOLIO_ROWS;
  protected readonly examples = TOKENIZED_EXAMPLES;
  protected readonly mistakes = DSL_COMMON_MISTAKES;
  protected readonly diagnostics = DSL_DIAGNOSTICS_TABLE;

  private readonly normalizedQuery = computed(() => this.referenceQuery().trim().toLowerCase());

  protected readonly filteredStateful = computed(() =>
    DSL_STATEFUL_FUNCTIONS.filter((fn) => matchesQuery(fn, this.normalizedQuery())),
  );
  protected readonly filteredLevelTrend = computed(() =>
    DSL_LEVEL_TREND_FUNCTIONS.filter((fn) => matchesQuery(fn, this.normalizedQuery())),
  );
  protected readonly filteredCandlePatterns = computed(() =>
    DSL_CANDLE_PATTERN_FUNCTIONS.filter((fn) => matchesQuery(fn, this.normalizedQuery())),
  );
  protected readonly filteredStructure = computed(() =>
    DSL_STRUCTURE_FUNCTIONS.filter((fn) => matchesQuery(fn, this.normalizedQuery())),
  );
  protected readonly filteredCrossbar = computed(() =>
    DSL_CROSSBAR_FUNCTIONS.filter((fn) => matchesQuery(fn, this.normalizedQuery())),
  );
  protected readonly filteredStateless = computed(() =>
    DSL_STATELESS_FUNCTIONS.filter((fn) => matchesQuery(fn, this.normalizedQuery())),
  );
  protected readonly hasAnyFilteredFunctions = computed(
    () =>
      this.filteredStateful().length > 0 ||
      this.filteredLevelTrend().length > 0 ||
      this.filteredCandlePatterns().length > 0 ||
      this.filteredStructure().length > 0 ||
      this.filteredCrossbar().length > 0 ||
      this.filteredStateless().length > 0,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });
  }

  protected selectTab(tab: DslGuideTabId): void {
    this.activeTab.set(tab);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected insertExample(code: string): void {
    this.insertCode.emit(code);
  }

  protected async copySnippet(id: string, code: string): Promise<void> {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      this.copiedId.set(id);
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
      }
      this.copyTimer = setTimeout(() => {
        this.copiedId.set(null);
        this.copyTimer = null;
      }, 2000);
    } catch {
      this.copiedId.set(null);
    }
  }
}
