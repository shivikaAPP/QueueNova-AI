import { OrgState, Recommendation } from './types.js';
import { getPulse } from './pulse.js';

export function getRecommendations(org: OrgState, now: number): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const nonClosedCounters = org.counters.filter((c) => c.status !== 'closed');
  const totalNonClosed = nonClosedCounters.length;

  for (const service of org.services) {
    const pulse = getPulse(org, service.id, now);
    const { level, waiting, rising, newArrivalEta } = pulse;
    const history = org.pulseHistory[service.id] || [];

    // Rule 1: Level critical
    if (level === 'critical') {
      const closedCompatible = org.counters
        .filter((c) => c.status === 'closed' && c.serviceIds.includes(service.id))
        .sort((a, b) => a.id.localeCompare(b.id));

      if (closedCompatible.length > 0) {
        const targetCounter = closedCompatible[0];
        const statusTrend = rising ? 'rising' : 'steady';
        recommendations.push({
          serviceId: service.id,
          type: 'open_counter',
          counterId: targetCounter.id,
          reason: `Queue pressure is Critical. ${waiting} customers are waiting for ${service.name} and the estimated wait is ${statusTrend}. Open ${targetCounter.name} if staff are available.`,
        });
        continue;
      }

      const idleNonSupporting = org.counters
        .filter((c) => c.status === 'available' && !c.serviceIds.includes(service.id))
        .sort((a, b) => a.id.localeCompare(b.id));

      if (idleNonSupporting.length > 0) {
        const targetCounter = idleNonSupporting[0];
        recommendations.push({
          serviceId: service.id,
          type: 'reassign_counter',
          counterId: targetCounter.id,
          reason: `Queue pressure is Critical. ${waiting} customers are waiting for ${service.name}. Reassign ${targetCounter.name} to support ${service.name}.`,
        });
        continue;
      }

      recommendations.push({
        serviceId: service.id,
        type: 'add_counter',
        reason: `All counters that support ${service.name} are already open. Consider adding a counter.`,
      });
      continue;
    }

    // Rule 2: Level busy and rising
    if (level === 'busy' && rising) {
      const closedCompatible = org.counters
        .filter((c) => c.status === 'closed' && c.serviceIds.includes(service.id))
        .sort((a, b) => a.id.localeCompare(b.id));

      const counterNotice = closedCompatible.length > 0
        ? ` Consider opening ${closedCompatible[0].name} to balance load.`
        : ' Consider reallocating staff to prevent delays.';

      recommendations.push({
        serviceId: service.id,
        type: 'review_allocation',
        counterId: closedCompatible[0]?.id,
        reason: `Queue pressure is Busy and rising. ${waiting} customers are waiting for ${service.name} with estimated wait ${newArrivalEta ?? 0} minutes.${counterNotice}`,
      });
      continue;
    }

    // Rule 3: Last five snapshots all calm and at least 2 non-closed counters support the service
    if (history.length >= 5) {
      const last5 = history.slice(-5);
      const allCalm = last5.every((s) => s.level === 'calm');
      const openSupporting = org.counters.filter(
        (c) => c.status !== 'closed' && c.serviceIds.includes(service.id)
      );

      if (allCalm && openSupporting.length >= 2) {
        // Must name an available (idle) counter
        const idleCandidate = openSupporting.find(
          (c) => c.status === 'available' && c.currentTokenId === null
        );

        if (idleCandidate) {
          // Hard guards:
          // 1. Never recommend closing if totalNonClosed <= 1
          // 2. Never recommend closing if openSupporting.length <= 1
          // 3. Never recommend closing a counter that has a token (checked via currentTokenId === null and status === 'available')
          if (totalNonClosed > 1 && openSupporting.length > 1) {
            recommendations.push({
              serviceId: service.id,
              type: 'review_staffing',
              counterId: idleCandidate.id,
              reason: `Demand is Calm. You may review staffing and consider closing ${idleCandidate.name}.`,
            });
            continue;
          }
        }
      }
    }
  }

  return recommendations;
}
