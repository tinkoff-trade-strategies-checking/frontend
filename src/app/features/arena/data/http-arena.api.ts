import { inject, Injectable } from '@angular/core';
import { filter, map, Observable } from 'rxjs';
import { Api } from '../../../api/api';
import { ApiConfiguration } from '../../../api/api-configuration';
import { cancelOrder } from '../../../api/fn/sessions/cancel-order';
import { controlPlayer } from '../../../api/fn/sessions/control-player';
import { estimateOrder } from '../../../api/fn/sessions/estimate-order';
import { finishSession } from '../../../api/fn/sessions/finish-session';
import { getSessionSnapshot } from '../../../api/fn/sessions/get-session-snapshot';
import { placeOrder } from '../../../api/fn/sessions/place-order';
import { replaceOrder } from '../../../api/fn/sessions/replace-order';
import { OrderParams } from '../../../api/models/order-params';
import { PlaceOrderRequest } from '../../../api/models/place-order-request';
import { EstimateOrderRequest } from '../../../api/models/estimate-order-request';
import { withIdempotency } from '../../../core/idempotency';
import {
  EVENT_SOURCE_FACTORY,
  SessionStreamItem,
  sessionEventStream,
} from '../../../core/session-events';
import {
  mapCommandResult,
  mapEvent,
  mapFinishResult,
  mapPlayerState,
  mapSnapshot,
  num,
  toPctString,
  toPriceString,
} from './arena.mappers';
import {
  ArenaApi,
  ArenaCommandResult,
  ArenaEvent,
  ArenaFinishResult,
  ArenaPlayerState,
  ArenaSnapshot,
  ArenaSpeed,
  ArenaStepResult,
  CancelOrderCommand,
  EstimateOrderCommand,
  OrderEstimateResult,
  PlaceOrderCommand,
  PlayerAction,
  ReplaceOrderCommand,
} from './arena.models';

interface PriceFields {
  readonly limitPrice?: number;
  readonly stopPrice?: number;
  readonly takeProfitPrice?: number;
  readonly trailingPct?: number;
}

function priceParams(fields: PriceFields): OrderParams {
  return {
    limitPrice: fields.limitPrice === undefined ? null : toPriceString(fields.limitPrice),
    stopPrice: fields.stopPrice === undefined ? null : toPriceString(fields.stopPrice),
    takeProfitPrice:
      fields.takeProfitPrice === undefined ? null : toPriceString(fields.takeProfitPrice),
    trailingPct: fields.trailingPct === undefined ? null : toPctString(fields.trailingPct),
  };
}

/**
 * Арена на настоящем API. Время ведёт сервер: `control` шлёт команды плеера, шаги приходят в `events()`.
 * Режим сессии (слепая или раскрытая) берётся из снимка: от него зависит, как адресуется бумага.
 */
@Injectable()
export class HttpArenaApi implements ArenaApi {
  readonly serverDriven = true;

  private readonly api = inject(Api);
  private readonly config = inject(ApiConfiguration);
  private readonly eventSourceFactory = inject(EVENT_SOURCE_FACTORY);

  private sessionId: string | null = null;
  private blind = true;

  async getSnapshot(sessionId?: string): Promise<ArenaSnapshot> {
    const id = sessionId ?? this.sessionId;
    if (!id) {
      throw new Error('Откройте сессию из «Новая сессия» или «История».');
    }
    const snapshot = await this.api.invoke(getSessionSnapshot, { sessionId: id });
    this.sessionId = snapshot.sessionId;
    this.blind = snapshot.mode === 'BLIND';
    return mapSnapshot(snapshot);
  }

  async control(action: PlayerAction, speed?: ArenaSpeed): Promise<ArenaPlayerState> {
    const sessionId = this.requireSession();
    const body = action === 'speed' ? { action, speed } : { action };
    const state = await withIdempotency((key) =>
      this.api.invoke(controlPlayer, { sessionId, 'Idempotency-Key': key, body }),
    );
    return mapPlayerState(state);
  }

  async step(): Promise<ArenaStepResult> {
    const state = await this.control('step');
    if (!state.stepResult) {
      throw new Error('Сервер не вернул результат шага.');
    }
    return state.stepResult;
  }

  events(): Observable<ArenaEvent> {
    const sessionId = this.requireSession();
    const url = `${this.config.rootUrl}/sessions/${sessionId}/events`;
    return sessionEventStream(url, this.eventSourceFactory).pipe(
      map((item: SessionStreamItem): ArenaEvent | null =>
        item.type === 'resync' ? { type: 'resync' } : mapEvent(item),
      ),
      filter((event): event is ArenaEvent => event !== null),
    );
  }

  async estimateOrder(command: EstimateOrderCommand): Promise<OrderEstimateResult> {
    const sessionId = this.requireSession();
    const common = { side: 'buy', type: 'market', lots: command.lots, tif: 'day' } as const;
    const body: EstimateOrderRequest = this.blind
      ? { ...common, paperIndex: Number(command.paperId) }
      : { ...common, paperId: command.paperId };
    const estimate = await this.api.invoke(estimateOrder, { sessionId, body });
    return { amountPct: num(estimate.amountPct) };
  }

  async placeOrder(command: PlaceOrderCommand): Promise<ArenaCommandResult> {
    const sessionId = this.requireSession();
    const common = {
      ...priceParams(command),
      seenStep: command.seenStep,
      side: command.side,
      type: command.type,
      lots: command.lots,
      tif: command.tif,
    };
    const body: PlaceOrderRequest = this.blind
      ? { ...common, paperIndex: Number(command.paperId) }
      : { ...common, paperId: command.paperId };
    const result = await withIdempotency((key) =>
      this.api.invoke(placeOrder, { sessionId, 'Idempotency-Key': key, body }),
    );
    return mapCommandResult(result);
  }

  async cancelOrder(command: CancelOrderCommand): Promise<ArenaCommandResult> {
    const sessionId = this.requireSession();
    const result = await withIdempotency((key) =>
      this.api.invoke(cancelOrder, {
        sessionId,
        orderId: command.orderId,
        seenStep: command.seenStep,
        'Idempotency-Key': key,
      }),
    );
    return mapCommandResult(result);
  }

  async replaceOrder(command: ReplaceOrderCommand): Promise<ArenaCommandResult> {
    const sessionId = this.requireSession();
    const result = await withIdempotency((key) =>
      this.api.invoke(replaceOrder, {
        sessionId,
        orderId: command.orderId,
        'Idempotency-Key': key,
        body: {
          ...priceParams(command),
          seenStep: command.seenStep,
          lots: command.lots,
          tif: command.tif,
        },
      }),
    );
    return mapCommandResult(result);
  }

  async finishSession(): Promise<ArenaFinishResult> {
    const sessionId = this.requireSession();
    return mapFinishResult(await this.api.invoke(finishSession, { sessionId }));
  }

  private requireSession(): string {
    if (!this.sessionId) {
      throw new Error('Сессия не загружена.');
    }
    return this.sessionId;
  }
}
