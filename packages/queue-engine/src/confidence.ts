import { OrgState } from './types.js';

export function getConfidence(
  org: OrgState,
  serviceId: string,
  now: number
): 'stable' | 'changing' | 'insufficient' {
  const serviceRecords = org.records
    .filter((r) => r.serviceId === serviceId)
    .slice(-5);

  if (serviceRecords.length < 3) {
    return 'insufficient';
  }

  const durations = serviceRecords.map((r) => r.durationMinutes);
  const mean = durations.reduce((acc, d) => acc + d, 0) / durations.length;

  if (mean === 0) {
    return 'changing';
  }

  const variance = durations.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  const windowMs = (org.settings.confidenceWindowMinutes ?? 10) * 60000;
  const cutoff = now - windowMs;

  const supportingCounters = org.counters
    .filter((c) => c.serviceIds.includes(serviceId))
    .map((c) => c.id);

  const recentCounterChange = org.counterLog.some(
    (entry) => supportingCounters.includes(entry.counterId) && entry.at >= cutoff
  );

  if (recentCounterChange) {
    return 'changing';
  }

  const maxCv = org.settings.confidenceMaxCv ?? 0.35;
  if (cv <= maxCv) {
    return 'stable';
  }

  return 'changing';
}
