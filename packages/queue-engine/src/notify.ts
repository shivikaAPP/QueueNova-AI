import { Notification } from './types.js';

export function createNotification(
  kind: Notification['kind'],
  message: string,
  now: number,
  tokenId: string | null = null,
  seq: number = 1
): Notification {
  return {
    id: `notif-${now}-${tokenId ? tokenId.replace(/[^a-zA-Z0-9]/g, '') : 'staff'}-${seq}`,
    tokenId,
    kind,
    message,
    createdAt: now,
    read: false,
  };
}

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
