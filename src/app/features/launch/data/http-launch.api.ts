import { inject, Injectable } from '@angular/core';
import { Api } from '../../../api/api';
import { createSession } from '../../../api/fn/sessions/create-session';
import { getLaunchOptions } from '../../../api/fn/marketdata/get-launch-options';
import { listAvailablePapers } from '../../../api/fn/marketdata/list-available-papers';
import { LaunchOptions as ApiLaunchOptions } from '../../../api/models/launch-options';
import { LaunchRejectReason as ApiLaunchRejectReason } from '../../../api/models/launch-reject-reason';
import { toProblem } from '../../../core/api-problem';
import {
  CandleTimeframe,
  LaunchApi,
  LaunchCommandResult,
  LaunchCustomPaper,
  LaunchOptions,
  StartSessionCommand,
} from './launch.models';

// Исчерпывающая запись по сгенерированному типу: новая причина в контракте не соберётся, пока её не учтут.
const REJECT_REASONS: Readonly<Record<ApiLaunchRejectReason, true>> = {
  NO_MATCHING_PERIOD: true,
  TOO_MANY_BARS: true,
  INVALID_PARAMS: true,
  CORPORATE_ACTION_ON_PERIOD: true,
};

function isRejectReason(code: string | null): code is ApiLaunchRejectReason {
  return code !== null && Object.hasOwn(REJECT_REASONS, code);
}

/**
 * Деньги и проценты контракта — десятичные строки (INV-6). Число нужно только полю ввода и подписям;
 * арифметики над ним нет: в запрос уходит значение поля, отформатированное до 2 знаков.
 */
export function mapLaunchOptions(options: ApiLaunchOptions): LaunchOptions {
  const rules = options.executionRules;
  return {
    durations: options.durations,
    defaultDuration: options.defaultDuration,
    availableTimeframes: options.availableTimeframes,
    maxDurationDaysByTimeframe: options.maxDurationDaysByTimeframe as Record<
      CandleTimeframe,
      number
    >,
    defaultTimeframe: options.defaultTimeframe,
    regimes: options.regimes,
    defaultRegime: options.defaultRegime,
    capitalPresetsRub: options.capitalPresets.map(Number),
    defaultCapitalRub: Number(options.defaultCapital),
    backgroundAlgorithmName: options.backgroundAlgorithmName,
    minPapers: options.minPapers,
    maxPapers: options.maxPapers,
    defaultPaperCount: options.defaultPaperCount,
    executionRules: {
      commissionPct: Number(rules.commissionPct),
      exchangeFeePct: Number(rules.exchangeFeePct),
      spreadPct: Number(rules.spreadPct),
      slippageKappa: Number(rules.slippageKappa),
      liquidityLimitPct: Number(rules.liquidityLimitPct),
      maxBars: rules.maxBars,
    },
    archiveFrom: options.archiveFrom ?? null,
    archiveTo: options.archiveTo ?? null,
  };
}

@Injectable()
export class HttpLaunchApi implements LaunchApi {
  private readonly api = inject(Api);

  async getLaunchOptions(): Promise<LaunchOptions> {
    return mapLaunchOptions(await this.api.invoke(getLaunchOptions));
  }

  async getAvailablePapers(): Promise<readonly LaunchCustomPaper[]> {
    return this.api.invoke(listAvailablePapers);
  }

  async startSession(command: StartSessionCommand): Promise<LaunchCommandResult> {
    try {
      const created = await this.api.invoke(createSession, {
        body: {
          ...command,
          paperIds: command.paperIds === null ? null : [...command.paperIds],
          backgroundAlgorithmId: command.backgroundAlgorithmId,
        },
      });
      return { accepted: true, sessionId: created.sessionId };
    } catch (error) {
      // Отказ запуска — 422 с кодом из LaunchRejectReason: это ответ пользователю, а не сбой.
      const problem = toProblem(error);
      if (problem.status === 422 && isRejectReason(problem.code)) {
        return {
          accepted: false,
          reason: problem.code,
          field: problem.field,
          barsCount: problem.barsCount,
          maxBars: problem.maxBars,
        };
      }
      throw error;
    }
  }
}
