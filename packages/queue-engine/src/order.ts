import { Customer, AppointmentSlot, Settings } from './types.js';

export function getTierRank(customer: Customer): number {
  if (customer.priority === 'approved') {
    return 0; // accessibility
  }
  if (customer.slotId) {
    return 1; // appointment
  }
  return 2; // walkin
}

export function parseTokenSeq(token: string | undefined): number {
  if (!token) return 0;
  const parts = token.split('-');
  const num = parseInt(parts[parts.length - 1], 10);
  return isNaN(num) ? 0 : num;
}

export function compareWaitingCustomers(a: Customer, b: Customer): number {
  const rankA = getTierRank(a);
  const rankB = getTierRank(b);
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  if (a.queueTime !== b.queueTime) {
    return a.queueTime - b.queueTime;
  }
  return parseTokenSeq(a.token) - parseTokenSeq(b.token);
}

export function isSlotValidNow(slot: AppointmentSlot, settings: Settings, now: number): boolean {
  const earlyMs = settings.appointmentEarlyMinutes * 60000;
  const lateMs = settings.appointmentLateMinutes * 60000;
  return now >= slot.startsAt - earlyMs && now <= slot.startsAt + lateMs;
}
