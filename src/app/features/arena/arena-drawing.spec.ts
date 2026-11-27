import {
  addDrawingForPaper,
  ArenaDrawing,
  ChartCoordinateProjector,
  clampLabelBox,
  clearDrawingsForPaper,
  computeFibLevels,
  computeRulerMetrics,
  DrawingsByPaper,
  FIB_RATIOS,
  formatBarsCount,
  formatPriceDelta,
  formatRulerLines,
  getDrawingsForPaper,
  projectDrawing,
  projectDrawings,
  snapTimeToOrderedTimes,
  undoDrawingForPaper,
} from './arena-drawing';

function makeLinearProjector(width = 800, height = 360): ChartCoordinateProjector {
  return {
    width,
    height,
    timeToX: (time) => (time - 1000) * 10,
    priceToY: (price) => 300 - price,
  };
}

describe('arena-drawing', () => {
  describe('computeFibLevels', () => {
    it('вычисляет все 7 стандартных уровней коррекции Фибоначчи при росте', () => {
      const levels = computeFibLevels(100, 200);
      expect(levels.map((l) => l.ratio)).toEqual([...FIB_RATIOS]);
      expect(levels.map((l) => l.label)).toEqual([
        '0%',
        '23.6%',
        '38.2%',
        '50%',
        '61.8%',
        '78.6%',
        '100%',
      ]);
      expect(levels[0].price).toBeCloseTo(200, 6);
      expect(levels[1].price).toBeCloseTo(176.4, 6);
      expect(levels[2].price).toBeCloseTo(161.8, 6);
      expect(levels[3].price).toBeCloseTo(150, 6);
      expect(levels[4].price).toBeCloseTo(138.2, 6);
      expect(levels[5].price).toBeCloseTo(121.4, 6);
      expect(levels[6].price).toBeCloseTo(100, 6);
    });

    it('корректно работает при падении (start > end) и при равных ценах', () => {
      const down = computeFibLevels(200, 100);
      expect(down[0].price).toBeCloseTo(100, 6);
      expect(down[3].price).toBeCloseTo(150, 6);
      expect(down[6].price).toBeCloseTo(200, 6);

      const flat = computeFibLevels(150, 150);
      expect(flat.every((l) => l.price === 150)).toBe(true);
    });
  });

  describe('computeRulerMetrics и форматирование (INV-7)', () => {
    it('вычисляет Δ цены, Δ% и Δ баров по orderedTimes и без них', () => {
      const orderedTimes = [1000, 1001, 1002, 1005, 1006];
      const metrics = computeRulerMetrics(
        { time: 1001, price: 100 },
        { time: 1006, price: 112.5 },
        orderedTimes,
      );
      expect(metrics.priceDelta).toBeCloseTo(12.5, 6);
      expect(metrics.pctDelta).toBeCloseTo(12.5, 6);
      expect(metrics.barsDelta).toBe(3);
      expect(metrics.isPositive).toBe(true);

      const fallback = computeRulerMetrics({ time: 1010, price: 200 }, { time: 1004, price: 180 });
      expect(fallback.priceDelta).toBeCloseTo(-20, 6);
      expect(fallback.pctDelta).toBeCloseTo(-10, 6);
      expect(fallback.barsDelta).toBe(6);
      expect(fallback.isPositive).toBe(false);
    });

    it('не делит на ноль при нулевой стартовой цене', () => {
      const metrics = computeRulerMetrics({ time: 1000, price: 0 }, { time: 1002, price: 50 });
      expect(metrics.pctDelta).toBe(0);
      expect(metrics.priceDelta).toBe(50);
    });

    it('склоняет слово «бар» по правилам русского языка', () => {
      expect(formatBarsCount(0)).toBe('0 баров');
      expect(formatBarsCount(1)).toBe('1 бар');
      expect(formatBarsCount(2)).toBe('2 бара');
      expect(formatBarsCount(4)).toBe('4 бара');
      expect(formatBarsCount(5)).toBe('5 баров');
      expect(formatBarsCount(11)).toBe('11 баров');
      expect(formatBarsCount(14)).toBe('14 баров');
      expect(formatBarsCount(21)).toBe('21 бар');
      expect(formatBarsCount(23)).toBe('23 бара');
      expect(formatBarsCount(25)).toBe('25 баров');
      expect(formatBarsCount(101)).toBe('101 бар');
    });

    it('INV-7: в слепом режиме не добавляет символ ₽, а в раскрытом — добавляет', () => {
      expect(formatPriceDelta(15.5, true)).not.toContain('₽');
      expect(formatPriceDelta(15.5, true)).toBe('+15,50');
      expect(formatPriceDelta(-4.25, true)).toBe('−4,25');
      expect(formatPriceDelta(0, true)).toBe('0,00');

      expect(formatPriceDelta(15.5, false)).toContain('₽');
      expect(formatPriceDelta(-4.25, false)).toContain('₽');

      const metrics = computeRulerMetrics({ time: 1000, price: 100 }, { time: 1005, price: 110 });
      const blindLines = formatRulerLines(metrics, true);
      expect(blindLines.join(' ')).not.toContain('₽');
      expect(blindLines[0]).toContain('+10,00 %');
      expect(blindLines[1]).toBe('+10,00');
      expect(blindLines[2]).toBe('5 баров');

      const openLines = formatRulerLines(metrics, false);
      expect(openLines[1]).toContain('₽');
    });
  });

  describe('геометрия и проекция на координаты графика', () => {
    it('проецирует горизонтальный уровень, тренд, Фибоначчи и линейку', () => {
      const proj = makeLinearProjector(600, 320);

      const hline = projectDrawing({ id: 'h1', kind: 'hline', price: 150 }, proj, true);
      expect(hline).toEqual({
        id: 'h1',
        kind: 'hline',
        y: 150,
        width: 600,
        priceLabel: '150,00',
      });

      const trend = projectDrawing(
        {
          id: 't1',
          kind: 'trendline',
          start: { time: 1005, price: 100 },
          end: { time: 1020, price: 180 },
        },
        proj,
        true,
      );
      expect(trend).toEqual({
        id: 't1',
        kind: 'trendline',
        x1: 50,
        y1: 200,
        x2: 200,
        y2: 120,
      });

      const fib = projectDrawing(
        {
          id: 'f1',
          kind: 'fib',
          start: { time: 1020, price: 100 },
          end: { time: 1005, price: 200 },
        },
        proj,
        true,
      );
      expect(fib?.kind).toBe('fib');
      if (fib?.kind === 'fib') {
        expect(fib.x1).toBe(50);
        expect(fib.x2).toBe(200);
        expect(fib.levels.length).toBe(7);
        expect(fib.bands.length).toBe(6);
      }

      const ruler = projectDrawing(
        {
          id: 'r1',
          kind: 'ruler',
          start: { time: 1002, price: 100 },
          end: { time: 1012, price: 120 },
        },
        proj,
        true,
      );
      expect(ruler?.kind).toBe('ruler');
      if (ruler?.kind === 'ruler') {
        expect(ruler.x).toBe(20);
        expect(ruler.width).toBe(100);
        expect(ruler.height).toBe(20);
        expect(ruler.isPositive).toBe(true);
        expect(ruler.lines.join(' ')).not.toContain('₽');
        expect(ruler.lines[2]).toBe('10 баров');
      }
    });

    it('возвращает null, если координаты не определены или область пуста', () => {
      const nullProj: ChartCoordinateProjector = {
        width: 500,
        height: 300,
        timeToX: () => null,
        priceToY: () => null,
      };
      expect(projectDrawing({ id: 'h1', kind: 'hline', price: 100 }, nullProj, true)).toBeNull();
      expect(
        projectDrawings(
          [
            { id: 'h1', kind: 'hline', price: 100 },
            {
              id: 't1',
              kind: 'trendline',
              start: { time: 1000, price: 100 },
              end: { time: 1005, price: 110 },
            },
          ],
          makeLinearProjector(0, 0),
          true,
        ),
      ).toEqual([]);
    });

    it('удерживает плашку линейки внутри границ графика (clampLabelBox)', () => {
      expect(clampLabelBox(-50, -30, 150, 50, 400, 300, 6)).toEqual({ x: 6, y: 6 });
      expect(clampLabelBox(380, 290, 150, 50, 400, 300, 6)).toEqual({ x: 244, y: 244 });
    });

    it('привязывает время к ближайшему бару (snapTimeToOrderedTimes)', () => {
      expect(snapTimeToOrderedTimes(1005, [])).toBeNull();
      expect(snapTimeToOrderedTimes(1003.2, [1000, 1002, 1005, 1010])).toBe(1002);
      expect(snapTimeToOrderedTimes(1004.1, [1000, 1002, 1005, 1010])).toBe(1005);
      expect(snapTimeToOrderedTimes(999, [1000, 1002])).toBe(1000);
      expect(snapTimeToOrderedTimes(1050, [1000, 1002])).toBe(1002);
    });
  });

  describe('хранилище рисунков по paperKey', () => {
    it('изолирует рисунки разных бумаг, поддерживает отмену и очистку', () => {
      const h1: ArenaDrawing = { id: '1', kind: 'hline', price: 100 };
      const h2: ArenaDrawing = { id: '2', kind: 'hline', price: 120 };
      const hB: ArenaDrawing = { id: '3', kind: 'hline', price: 250 };

      let store: DrawingsByPaper = {};
      store = addDrawingForPaper(store, 's1:A', h1);
      store = addDrawingForPaper(store, 's1:A', h2);
      store = addDrawingForPaper(store, 's1:B', hB);

      expect(getDrawingsForPaper(store, 's1:A')).toEqual([h1, h2]);
      expect(getDrawingsForPaper(store, 's1:B')).toEqual([hB]);
      expect(getDrawingsForPaper(store, 's1:C')).toEqual([]);

      store = undoDrawingForPaper(store, 's1:A');
      expect(getDrawingsForPaper(store, 's1:A')).toEqual([h1]);
      expect(getDrawingsForPaper(store, 's1:B')).toEqual([hB]);

      store = clearDrawingsForPaper(store, 's1:A');
      expect(getDrawingsForPaper(store, 's1:A')).toEqual([]);
      expect(getDrawingsForPaper(store, 's1:B')).toEqual([hB]);
    });
  });
});
