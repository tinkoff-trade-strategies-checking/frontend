import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HistoryEntryBase } from '../../../api/models/history-entry-base';
import { formatPeriod, HttpHistoryApi, mapHistoryEntry } from './http-history.api';

const BASE: HistoryEntryBase = {
  id: '0190-1',
  kind: 'session',
  owner: 'USER',
  createdAt: '2026-11-18T12:00:00Z',
  regime: 'stress',
  playedDays: 20,
  totalDays: 60,
  algoName: null,
  blind: false,
  status: 'completed',
};

describe('mapHistoryEntry', () => {
  it('завершённая запись: период — календарные даты без сдвига часового пояса, доходность — число', () => {
    const entry = mapHistoryEntry({
      ...BASE,
      view: 'REVEALED',
      title: 'SBER · 60 дн.',
      papers: ['SBER'],
      period: { startDate: '2020-02-26', endDate: '2020-05-21' },
      netReturnPct: '-2.140000',
    });
    expect(entry).toMatchObject({
      status: 'completed',
      periodLabel: '26.02.2020 — 21.05.2020',
      netReturnPct: -2.14,
    });
    expect(formatPeriod({ startDate: '2021-01-05', endDate: '2021-12-31' })).toBe(
      '05.01.2021 — 31.12.2021',
    );
  });

  it('INV-7: слепая незавершённая запись — только общие поля, даже если пришли лишние', () => {
    const entry = mapHistoryEntry({
      ...BASE,
      blind: true,
      status: 'running',
      view: 'BLIND_UNFINISHED',
      title: 'SBER',
      papers: ['SBER'],
      period: { startDate: '2020-02-26', endDate: '2020-05-21' },
      netReturnPct: '5.0',
    } as never);
    expect(entry).toEqual({
      id: '0190-1',
      kind: 'session',
      owner: 'USER',
      createdAt: '2026-11-18T12:00:00Z',
      regime: 'stress',
      playedDays: 20,
      totalDays: 60,
      algoName: null,
      blind: true,
      status: 'running',
    });
  });

  it('INV-7: запрещённое сочетание blind + running в REVEALED тоже маскируется', () => {
    const entry = mapHistoryEntry({
      ...BASE,
      blind: true,
      status: 'running',
      view: 'REVEALED',
      title: 'SBER',
      papers: ['SBER'],
      period: { startDate: '2020-02-26', endDate: '2020-05-21' },
      netReturnPct: null,
    });
    expect(entry).not.toHaveProperty('title');
    expect(entry).not.toHaveProperty('periodLabel');
  });

  it('INV-1: идущая неслепая сессия — без итоговой доходности', () => {
    const entry = mapHistoryEntry({
      ...BASE,
      status: 'running',
      view: 'REVEALED',
      title: 'SBER',
      papers: ['SBER'],
      period: { startDate: '2020-02-26', endDate: '2020-05-21' },
      netReturnPct: '1.5',
    });
    expect(entry.status).toBe('running');
    expect(entry).not.toHaveProperty('netReturnPct');
  });

  it('завершённая запись без итога (null) не падает', () => {
    const entry = mapHistoryEntry({
      ...BASE,
      view: 'REVEALED',
      title: 'SBER',
      papers: [],
      period: { startDate: '2020-02-26', endDate: '2020-05-21' },
      netReturnPct: null,
    });
    expect(entry).toMatchObject({ netReturnPct: null });
  });
});

describe('HttpHistoryApi', () => {
  let api: HttpHistoryApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpHistoryApi],
    });
    api = TestBed.inject(HttpHistoryApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('фильтры «все» не уходят в запрос, остальные — query-параметрами', async () => {
    const pending = api.list({
      kind: 'all',
      status: 'running',
      regime: 'all',
      blindOnly: true,
      page: 2,
    });
    const req = controller.expectOne((r) => r.url === '/api/v1/history');
    expect(req.request.params.has('kind')).toBe(false);
    expect(req.request.params.has('regime')).toBe(false);
    expect(req.request.params.get('status')).toBe('running');
    expect(req.request.params.get('blindOnly')).toBe('true');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], total: 0, page: 2, pageSize: 20, totalPages: 0 });
    expect(await pending).toEqual({ items: [], total: 0, page: 2, pageSize: 20, totalPages: 0 });
  });
});
