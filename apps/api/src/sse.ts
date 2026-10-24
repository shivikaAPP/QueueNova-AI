// apps/api/src/sse.ts
// Server-Sent Events broadcaster for real-time queue updates.
// Architecture.md section 14: GET /orgs/:orgId/events emits snapshot version on state change.

import type { FastifyReply } from 'fastify';

interface SseClient {
  orgId: string;
  reply: FastifyReply;
}

const clients: SseClient[] = [];

export function addClient(orgId: string, reply: FastifyReply): void {
  clients.push({ orgId, reply });
}

export function removeClient(reply: FastifyReply): void {
  const idx = clients.findIndex((c) => c.reply === reply);
  if (idx >= 0) clients.splice(idx, 1);
}

export function broadcast(orgId: string, version: number): void {
  const data = JSON.stringify({ type: 'snapshot', version });
  for (const client of clients) {
    if (client.orgId === orgId) {
      try {
        client.reply.raw.write(`data: ${data}\n\n`);
      } catch {
        // Client disconnected, will be cleaned up
      }
    }
  }
}

export function getClientCount(orgId: string): number {
  return clients.filter((c) => c.orgId === orgId).length;
}
