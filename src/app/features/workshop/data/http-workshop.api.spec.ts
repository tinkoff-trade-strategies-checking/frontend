import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpWorkshopApi } from './http-workshop.api';

describe('HttpWorkshopApi', () => {
  let api: HttpWorkshopApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpWorkshopApi],
    });
    api = TestBed.inject(HttpWorkshopApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('list и getById мапят latestVersionId, publishedAt: null и 200 READY/NOT_FOUND', async () => {
    const pendingList = api.list({ sort: 'name_asc', mineOnly: true, search: '  sma  ', page: 2 });
    const reqList = http.expectOne(
      '/api/v1/workshop/algorithms?sort=name_asc&mineOnly=true&search=sma&page=2&pageSize=20',
    );
    expect(reqList.request.method).toBe('GET');
    reqList.flush({
      items: [
        {
          id: 'alg-1',
          name: 'Draft Algo',
          description: '',
          authorId: 'u-1',
          author: 'Вы',
          isMine: true,
          isSystem: false,
          visibility: 'hidden',
          latestVersion: 0,
          latestVersionId: null,
          publishedAt: null,
          license: 'MIT',
          linterWarnings: [],
        },
      ],
      authors: [{ id: 'u-1', name: 'Вы' }],
      total: 1,
      page: 2,
      pageSize: 20,
      totalPages: 1,
    });
    const listRes = await pendingList;
    expect(listRes.items[0].publishedAt).toBeNull();
    expect(listRes.items[0].latestVersionId).toBeNull();

    const pendingDetail = api.getById('alg-missing');
    const reqDetail = http.expectOne('/api/v1/workshop/algorithms/alg-missing');
    reqDetail.flush({ status: 'NOT_FOUND' });
    expect(await pendingDetail).toEqual({ status: 'NOT_FOUND' });
  });

  it('createAlgorithm, getDraft, saveDraft, check, fork и setVisibility выполняют контракты', async () => {
    const draft = {
      strategyId: 'alg-2',
      name: 'Momentum',
      description: 'Desc',
      source: 'rule enter when close > 10 because "x";',
      updatedAt: '2026-11-22T12:00:00Z',
      check: { lookaheadLevel: 'OK', diagnostics: [], params: [] },
    };

    const pCreate = api.createAlgorithm({ name: 'Momentum', source: draft.source });
    const rCreate = http.expectOne('/api/v1/workshop/algorithms');
    expect(rCreate.request.method).toBe('POST');
    rCreate.flush(draft, { status: 201, statusText: 'Created' });
    expect((await pCreate).check?.lookaheadLevel).toBe('OK');

    const pDraft = api.getDraft('alg-2');
    http.expectOne('/api/v1/workshop/algorithms/alg-2/draft').flush(draft);
    expect((await pDraft).strategyId).toBe('alg-2');

    const pSave = api.saveDraft('alg-2', { source: 'updated' });
    const rSave = http.expectOne('/api/v1/workshop/algorithms/alg-2/draft');
    expect(rSave.request.method).toBe('PUT');
    rSave.flush({ ...draft, source: 'updated' });
    expect((await pSave).source).toBe('updated');

    const pCheck = api.check({ source: 'let a = 1;', paramOverrides: { p: 2 } });
    const rCheck = http.expectOne('/api/v1/workshop/check');
    expect(rCheck.request.method).toBe('POST');
    rCheck.flush({ lookaheadLevel: 'WARNING', diagnostics: [], params: [] });
    expect((await pCheck).lookaheadLevel).toBe('WARNING');

    const pFork = api.fork('alg-1', { version: 2, name: 'My Fork' });
    const rFork = http.expectOne('/api/v1/workshop/algorithms/alg-1/fork');
    expect(rFork.request.method).toBe('POST');
    rFork.flush(draft, { status: 201, statusText: 'Created' });
    expect((await pFork).strategyId).toBe('alg-2');

    const pVis = api.setVisibility('alg-2', 'public');
    const rVis = http.expectOne('/api/v1/workshop/algorithms/alg-2/visibility');
    expect(rVis.request.method).toBe('PATCH');
    expect(rVis.request.body).toEqual({ visibility: 'public' });
    rVis.flush({
      id: 'alg-2',
      name: 'Momentum',
      description: 'Desc',
      authorId: 'u-1',
      author: 'Вы',
      isMine: true,
      isSystem: false,
      visibility: 'public',
      latestVersion: 1,
      latestVersionId: 'ver-1',
      publishedAt: '2026-11-22T12:05:00Z',
      license: 'MIT',
      linterWarnings: [],
    });
    expect((await pVis).visibility).toBe('public');
  });

  it('publish возвращает версию при 201 и типизированный отказ STRATEGY_INVALID при 422', async () => {
    const pOk = api.publish('alg-2', { summary: 'v1' });
    const rOk = http.expectOne('/api/v1/workshop/algorithms/alg-2/publish');
    expect(rOk.request.method).toBe('POST');
    rOk.flush(
      {
        id: 'ver-1',
        version: 1,
        publishedAt: '2026-11-22T12:05:00Z',
        summary: 'v1',
        immutable: true,
      },
      { status: 201, statusText: 'Created' },
    );
    expect(await pOk).toMatchObject({ ok: true, version: { version: 1, id: 'ver-1' } });

    const pErr = api.publish('alg-2', { summary: 'bad' });
    const diag = {
      code: 'E-LA01',
      level: 'ERROR',
      startLine: 3,
      startColumn: 1,
      endLine: 3,
      endColumn: 10,
      message: 'Обращение к будущему бару',
      fixes: [],
    };
    http.expectOne('/api/v1/workshop/algorithms/alg-2/publish').flush(
      {
        code: 'STRATEGY_INVALID',
        detail: 'Strategy contains static errors and cannot be published',
        lookaheadLevel: 'ERROR',
        diagnostics: [diag],
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(await pErr).toEqual({
      ok: false,
      code: 'STRATEGY_INVALID',
      lookaheadLevel: 'ERROR',
      diagnostics: [diag],
    });
  });

  it('удаляет алгоритм через DELETE /workshop/algorithms/{id}', async () => {
    const pending = api.deleteAlgorithm('alg-2');
    const req = http.expectOne('/api/v1/workshop/algorithms/alg-2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(pending).resolves.toBeUndefined();
  });

  it('поддерживает 3-уровневую видимость (public / closed / hidden) при создании, смене и чтении с source: null', async () => {
    const pCreate = api.createAlgorithm({
      name: 'Closed Algo',
      source: 'rule x when close > 0 then buy 10 % cash because "ok"',
      visibility: 'closed',
    });
    const rCreate = http.expectOne('/api/v1/workshop/algorithms');
    expect(rCreate.request.method).toBe('POST');
    expect(rCreate.request.body).toMatchObject({ visibility: 'closed' });
    rCreate.flush(
      {
        strategyId: 'alg-closed',
        name: 'Closed Algo',
        description: '',
        visibility: 'closed',
        forkedFrom: null,
        source: 'rule x when close > 0 then buy 10 % cash because "ok"',
        latestVersion: 0,
        updatedAt: '2026-11-22T12:00:00Z',
        check: { lookaheadLevel: 'OK', diagnostics: [], params: [] },
      },
      { status: 201, statusText: 'Created' },
    );
    const created = await pCreate;
    expect(created.visibility).toBe('closed');
    expect(created.source).toContain('rule x');

    const pVis = api.setVisibility('alg-closed', 'closed');
    const rVis = http.expectOne('/api/v1/workshop/algorithms/alg-closed/visibility');
    expect(rVis.request.method).toBe('PATCH');
    expect(rVis.request.body).toEqual({ visibility: 'closed' });
    rVis.flush({
      id: 'alg-closed',
      name: 'Closed Algo',
      description: '',
      authorId: 'u-1',
      author: 'Вы',
      isMine: true,
      isSystem: false,
      visibility: 'closed',
      latestVersion: 1,
      latestVersionId: 'ver-1',
      publishedAt: '2026-11-22T12:05:00Z',
      license: 'MIT',
      linterWarnings: [],
    });
    expect((await pVis).visibility).toBe('closed');

    const pDetail = api.getById('alg-foreign-closed');
    http.expectOne('/api/v1/workshop/algorithms/alg-foreign-closed').flush({
      status: 'READY',
      algorithm: {
        id: 'alg-foreign-closed',
        name: 'Foreign Closed',
        description: '',
        authorId: 'u-2',
        author: 'Другой автор',
        isMine: false,
        isSystem: false,
        visibility: 'closed',
        latestVersion: 1,
        latestVersionId: 'ver-f1',
        publishedAt: '2026-11-22T12:05:00Z',
        license: 'MIT',
        linterWarnings: [],
        versions: [
          {
            id: 'ver-f1',
            version: 1,
            publishedAt: '2026-11-22T12:05:00Z',
            summary: 'v1',
            immutable: true,
            source: null,
          },
        ],
      },
    });
    const detail = await pDetail;
    expect(detail.status).toBe('READY');
    if (detail.status === 'READY') {
      expect(detail.algorithm.visibility).toBe('closed');
      expect(detail.algorithm.versions[0].source).toBeNull();
    }
  });
});
