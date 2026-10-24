# QueueNova

Digital queue tokens with live wait estimates.

QueueNova gives visitors a digital token and a live wait estimate, and shows staff which queues are filling up and which counters to open.

## Architecture

- `apps/web`: Fast modern React frontend with live queue displays, staff dashboards, and instant token passes.
- `apps/api`: Fastify backend API with rate limiting, secure cookie authentication, and real-time state synchronization.
- `packages/queue-engine`: Pure TypeScript queue engine with FairTurn scheduling, QueuePulse monitoring, and AutoCounter recommendations.

## Development

```bash
# Install dependencies
npm install

# Run web app in dev mode
npm run dev

# Run API server in dev mode
npm run dev:api

# Run tests
npm test
```
