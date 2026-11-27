import { TestBed } from '@angular/core/testing';
import { ReportRiskPanel } from './components/report-risk-panel';
import { EquityCurvePoint, ReportPaperCandleSeries, ReportPaperReveal } from './data/report.models';
import { StubReportApi } from './data/stub-report.api';
import {
  computeBetaAndCorrelation,
  computeHistoricalVarCvar,
  computePaperCorrelationMatrix,
  computePortfolioRisk,
  computeStepReturns,
  MAX_CORRELATION_PAPERS,
  paperCorrelationLabel,
} from './report-risk';

function makeEquityPoint(
  step: number,
  humanCapitalRub: number,
  benchmarkCapitalRub: number | null = null,
): EquityCurvePoint {
  return {
    step,
    dateLabel: `0${(step % 9) + 1}.03`,
    humanCapitalRub,
    algoCapitalRub: null,
    benchmarkCapitalRub,
  };
}

function makePaper(index: number, ticker?: string): ReportPaperReveal {
  return {
    id: `P-${index}`,
    blindLabel: `Бумага ${index}`,
    ticker: ticker ?? `T${index}`,
    name: `Компания ${index}`,
    sector: 'Финансы',
    startPriceRub: 100,
    lotSize: 1,
  };
}

describe('report-risk', () => {
  it('считает шаговые доходности и пропускает нулевые/отрицательные и null значения', () => {
    const returns = computeStepReturns([100, 110, 99, null, 0, 50]);
    expect(returns.length).toBe(2);
    expect(returns[0]).toBeCloseTo(0.1, 6);
    expect(returns[1]).toBeCloseTo(-0.1, 6);
  });

  it('вычисляет исторический VaR (95%) и CVaR (95%), причём CVaR <= VaR', () => {
    // 20 доходностей: худшие -0.10, -0.05, остальные положительные/небольшие
    const returns = [
      -0.1, -0.05, -0.02, -0.01, 0.0, 0.005, 0.01, 0.01, 0.015, 0.02, 0.02, 0.025, 0.03, 0.03,
      0.035, 0.04, 0.04, 0.045, 0.05, 0.06,
    ];
    const { varPct, cvarPct } = computeHistoricalVarCvar(returns, 0.95);
    expect(varPct).toBeCloseTo(-10, 6);
    expect(cvarPct).toBeCloseTo(-10, 6);

    // 40 доходностей: tailCount = ceil(0.05 * 40) = 2 -> sorted[1] для VaR, среднее первых 2 для CVaR
    const returns40 = [-0.08, -0.04, ...Array.from({ length: 38 }, () => 0.01)];
    const res40 = computeHistoricalVarCvar(returns40, 0.95);
    expect(res40.varPct).toBeCloseTo(-4, 6);
    expect(res40.cvarPct).toBeCloseTo(-6, 6);
    expect(res40.cvarPct!).toBeLessThanOrEqual(res40.varPct!);
  });

  it('возвращает null для VaR/CVaR при слишком малой выборке (< 2 доходностей)', () => {
    expect(computeHistoricalVarCvar([])).toEqual({ varPct: null, cvarPct: null });
    expect(computeHistoricalVarCvar([-0.02])).toEqual({ varPct: null, cvarPct: null });
  });

  it('точно вычисляет бету и корреляцию Пирсона к IMOEX', () => {
    const market = [0.01, -0.02, 0.03, -0.01, 0.02];
    const doubled = market.map((r) => r * 2);
    const inverse = market.map((r) => -r);

    const pos = computeBetaAndCorrelation(doubled, market);
    expect(pos.beta).toBeCloseTo(2, 6);
    expect(pos.correlation).toBeCloseTo(1, 6);

    const neg = computeBetaAndCorrelation(inverse, market);
    expect(neg.beta).toBeCloseTo(-1, 6);
    expect(neg.correlation).toBeCloseTo(-1, 6);
  });

  it('возвращает null для беты/корреляции при отсутствии бенчмарка или нулевой дисперсии', () => {
    const noBench = [makeEquityPoint(0, 100), makeEquityPoint(1, 105), makeEquityPoint(2, 102)];
    const riskNoBench = computePortfolioRisk(noBench);
    expect(riskNoBench.var95Pct).not.toBeNull();
    expect(riskNoBench.betaToImoex).toBeNull();
    expect(riskNoBench.correlationToImoex).toBeNull();

    const flatBench = [
      makeEquityPoint(0, 100, 100),
      makeEquityPoint(1, 105, 100),
      makeEquityPoint(2, 102, 100),
    ];
    const riskFlat = computePortfolioRisk(flatBench);
    expect(riskFlat.betaToImoex).toBeNull();
    expect(riskFlat.correlationToImoex).toBeNull();
  });

  it('строит симметричную матрицу корреляций бумаг с 1 на диагонали', () => {
    const papers = [makePaper(1, 'SBER'), makePaper(2, 'GAZP'), makePaper(3, 'YDEX')];
    const candles: ReportPaperCandleSeries[] = [
      { paperId: 'P-1', closes: [100, 110, 105, 120, 115] },
      { paperId: 'P-2', closes: [200, 220, 210, 240, 230] }, // точно пропорционально P-1 -> r = 1
      { paperId: 'P-3', closes: [100, 90, 94.5, 81, 84.375] }, // обратные доходности -> r ~ -1
    ];

    const matrix = computePaperCorrelationMatrix(papers, candles);
    expect(matrix).not.toBeNull();
    expect(matrix!.labels).toEqual(['SBER', 'GAZP', 'YDEX']);
    expect(matrix!.values[0][0]).toBe(1);
    expect(matrix!.values[0][1]).toBeCloseTo(1, 5);
    expect(matrix!.values[1][0]).toBeCloseTo(1, 5);
    expect(matrix!.values[0][2]).toBeLessThan(-0.95);
    expect(matrix!.truncatedCount).toBe(0);
  });

  it('INV-7: использует слепые метки при hideTickers=true или пустом тикере', () => {
    const papers = [makePaper(1, 'SBER'), makePaper(2, '')];
    const candles: ReportPaperCandleSeries[] = [
      { paperId: 'P-1', closes: [100, 102, 101, 105] },
      { paperId: 'P-2', closes: [50, 51, 52, 50] },
    ];

    expect(paperCorrelationLabel(papers[0], true)).toBe('Бумага 1');
    expect(paperCorrelationLabel(papers[1], false)).toBe('Бумага 2');

    const blindMatrix = computePaperCorrelationMatrix(papers, candles, { hideTickers: true });
    expect(blindMatrix!.labels).toEqual(['Бумага 1', 'Бумага 2']);
    expect(blindMatrix!.labels.join(',')).not.toContain('SBER');
  });

  it('ограничивает матрицу корреляций до 12 бумаг при >12 бумагах в отчёте', () => {
    const papers = Array.from({ length: 15 }, (_, i) => makePaper(i + 1, `P${i + 1}`));
    const candles: ReportPaperCandleSeries[] = papers.map((p, idx) => ({
      paperId: p.id,
      closes: [100, 101 + idx, 99 + idx, 104 + idx],
    }));

    const matrix = computePaperCorrelationMatrix(papers, candles);
    expect(matrix).not.toBeNull();
    expect(matrix!.labels.length).toBe(MAX_CORRELATION_PAPERS);
    expect(matrix!.values.length).toBe(MAX_CORRELATION_PAPERS);
    expect(matrix!.totalPapers).toBe(15);
    expect(matrix!.truncatedCount).toBe(3);
  });

  it('возвращает null для матрицы корреляций, если меньше 2 бумаг имеют свечи', () => {
    const papers = [makePaper(1, 'SBER'), makePaper(2, 'GAZP')];
    expect(computePaperCorrelationMatrix(papers, undefined)).toBeNull();
    expect(
      computePaperCorrelationMatrix(papers, [{ paperId: 'P-1', closes: [100, 102, 104] }]),
    ).toBeNull();
  });

  it('ReportRiskPanel отображает VaR, CVaR, бету, корреляцию и матрицу корреляций бумаг', async () => {
    const api = new StubReportApi();
    const res = await api.getReport('S-0103');
    if (res.status !== 'READY') {
      throw new Error('Ожидался готовый отчёт S-0103');
    }

    await TestBed.configureTestingModule({
      imports: [ReportRiskPanel],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReportRiskPanel);
    fixture.componentRef.setInput('report', res.report);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Риск-аналитика портфеля');
    expect(el.querySelector('[data-testid="risk-var95"]')?.textContent).toContain('%');
    expect(el.querySelector('[data-testid="risk-cvar95"]')?.textContent).toContain('%');
    expect(el.querySelector('[data-testid="risk-beta"]')?.textContent).not.toContain('—');
    expect(el.querySelector('[data-testid="risk-corr"]')?.textContent).not.toContain('—');
    const matrixEl = el.querySelector('[data-testid="risk-correlation-matrix"]');
    expect(matrixEl).not.toBeNull();
    expect(matrixEl?.textContent).toContain('SBER');
    expect(matrixEl?.textContent).toContain('GAZP');
    expect(matrixEl?.textContent).toContain('YDEX');
  });
});
