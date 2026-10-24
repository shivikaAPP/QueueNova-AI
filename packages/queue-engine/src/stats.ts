import { OrgState } from './types.js';

export interface FlowScoreResult {
  score: number | null;
  completionRate: number | null;
  waitPerformance: number | null;
  formula: string;
}

export function getFlowScore(org: OrgState): FlowScoreResult {
  const formula = 'round(100 * (0.5 * completionRate + 0.5 * waitPerformance))';
  const terminal = org.stats.completed + org.stats.cancelled + org.stats.expired;

  if (terminal === 0) {
    return {
      score: null,
      completionRate: null,
      waitPerformance: null,
      formula,
    };
  }

  const completionRate = org.stats.completed / terminal;

  const validRecords = org.records.filter((r) => r.estimateAtJoin !== null);
  if (validRecords.length === 0) {
    return {
      score: null,
      completionRate,
      waitPerformance: null,
      formula,
    };
  }

  const onTimeRecords = validRecords.filter(
    (r) => r.actualWaitMinutes <= (r.estimateAtJoin as number) + 5
  );
  const waitPerformance = onTimeRecords.length / validRecords.length;

  const score = Math.round(100 * (0.5 * completionRate + 0.5 * waitPerformance));

  return {
    score,
    completionRate,
    waitPerformance,
    formula,
  };
}

export interface OrgStatsOverview {
  registrations: number;
  completed: number;
  peakWaiting: number;
  activeCounters: number;
  avgDurationMinutes: number | null;
  meanEstimatedWaitMinutes: number | null;
  meanActualWaitMinutes: number | null;
  counterUtilisation: Record<string, number | null>;
  simulatedRecordsCount: number;
}

export function getStatsOverview(org: OrgState, now: number): OrgStatsOverview {
  const activeCounters = org.counters.filter((c) => c.status !== 'closed').length;

  let avgDurationMinutes: number | null = null;
  if (org.records.length > 0) {
    const totalDuration = org.records.reduce((acc, r) => acc + r.durationMinutes, 0);
    avgDurationMinutes = Math.round((totalDuration / org.records.length) * 10) / 10;
  }

  const recordsWithEstimate = org.records.filter((r) => r.estimateAtJoin !== null);
  let meanEstimatedWaitMinutes: number | null = null;
  let meanActualWaitMinutes: number | null = null;

  if (recordsWithEstimate.length > 0) {
    const totalEst = recordsWithEstimate.reduce((acc, r) => acc + (r.estimateAtJoin as number), 0);
    const totalAct = recordsWithEstimate.reduce((acc, r) => acc + r.actualWaitMinutes, 0);
    meanEstimatedWaitMinutes = Math.round((totalEst / recordsWithEstimate.length) * 10) / 10;
    meanActualWaitMinutes = Math.round((totalAct / recordsWithEstimate.length) * 10) / 10;
  }

  const counterUtilisation: Record<string, number | null> = {};

  const windowEvents = [
    ...org.counterLog.map((l) => l.at),
    ...org.records.map((r) => r.startedAt),
    ...org.records.map((r) => r.endedAt),
  ];
  const windowStart = windowEvents.length > 0 ? Math.min(...windowEvents) : now;
  const totalWindowMinutes = Math.max(0, (now - windowStart) / 60000);

  for (const counter of org.counters) {
    const counterRecords = org.records.filter((r) => r.counterId === counter.id);
    const servingMinutes = counterRecords.reduce((acc, r) => acc + r.durationMinutes, 0);

    const log = org.counterLog.filter((l) => l.counterId === counter.id).sort((a, b) => a.at - b.at);

    let openMinutes = 0;
    if (log.length === 0) {
      if (counter.status !== 'closed') {
        openMinutes = totalWindowMinutes;
      }
    } else {
      let lastStatus = log[0].status;
      let lastAt = windowStart;

      for (const entry of log) {
        if (entry.at > lastAt) {
          const duration = (entry.at - lastAt) / 60000;
          if (lastStatus !== 'closed') {
            openMinutes += duration;
          }
        }
        lastStatus = entry.status;
        lastAt = entry.at;
      }

      if (now > lastAt && lastStatus !== 'closed') {
        openMinutes += (now - lastAt) / 60000;
      }
    }

    if (openMinutes <= 0) {
      counterUtilisation[counter.id] = servingMinutes > 0 ? 1 : null;
    } else {
      counterUtilisation[counter.id] = Math.min(1, Math.round((servingMinutes / openMinutes) * 100) / 100);
    }
  }

  const simulatedRecordsCount = org.records.filter((r) => r.simulated).length;

  return {
    registrations: org.stats.registrations,
    completed: org.stats.completed,
    peakWaiting: org.stats.peakWaiting,
    activeCounters,
    avgDurationMinutes,
    meanEstimatedWaitMinutes,
    meanActualWaitMinutes,
    counterUtilisation,
    simulatedRecordsCount,
  };
}
