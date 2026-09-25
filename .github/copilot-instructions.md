# Horizon AI Runtime — Copilot Instructions

## Project

Horizon AI Runtime is a distributed AI inference platform developed by
Team Multi Horizon.

The MVP allows multiple machines to contribute compute resources and
allows AI developers to deploy models onto compatible workers.

The primary demonstration will use a quantized 7B-class DeepSeek model
through llama.cpp.

## Architecture

The MVP uses a modular monolith.

Components:

- Next.js frontend
- Node.js + TypeScript control plane
- Express
- PostgreSQL hosted on Neon
- Drizzle ORM
- Node.js + TypeScript worker agent
- Docker
- llama.cpp
- GGUF models

Do NOT introduce microservices for the MVP.

Do NOT introduce Kubernetes, Kafka, Redis, blockchain, or complex
distributed infrastructure unless explicitly requested.

## Control Plane Modules

The control plane should be organized into:

- workers
- models
- deployments
- scheduler
- jobs
- health
- credits

Each module should keep its responsibilities separated.

Prefer:

routes
→ controllers
→ services
→ repositories
→ database

Do not place business logic directly inside route handlers.

## Database

PostgreSQL is hosted on Neon.

Use Drizzle ORM.

Never expose DATABASE_URL or database credentials to worker machines.

Workers communicate only with the Control Plane.

Worker architecture:

Worker
→ HTTPS/WebSocket
→ Control Plane
→ PostgreSQL

Never:

Worker
→ PostgreSQL

Use migrations for all schema changes.

Never modify production schema manually.

## Worker

The Worker Agent is responsible for:

- hardware discovery
- worker registration
- authentication
- heartbeat
- deployment instructions
- model runtime management
- health reporting
- resource usage reporting

The worker must support macOS and Windows where practical.

Do not assume GPU detection is identical across operating systems.

## Scheduler

The scheduler must select workers based on:

- online status
- CPU availability
- RAM availability
- GPU requirement
- VRAM requirement
- architecture compatibility

The MVP does NOT implement model parallelism.

One model instance runs entirely on one worker.

## Model Runtime

The primary LLM runtime is llama.cpp.

Models use GGUF.

The actual model weights should NOT be stored in PostgreSQL.

PostgreSQL stores model metadata and configuration.

Workers cache model files locally.

## Compute Credits

The MVP uses an internal PostgreSQL ledger.

No blockchain is required.

Credits should only be awarded for recorded and verified successful jobs.

Store the underlying usage information used to calculate rewards.

## Engineering Principles

Prefer simple implementations.

Do not over-engineer.

Do not introduce a dependency without explaining why it is necessary.

Use TypeScript strict mode.

Validate external input.

Use environment variables for configuration.

Never hardcode secrets.

Write tests for important business logic.

Prefer small, understandable functions.

Explain architectural decisions before implementing major changes.

## Development Strategy

Build incrementally.

The MVP order is:

1. Database
2. Control plane
3. Worker registration
4. Heartbeats
5. Resource discovery
6. Scheduler
7. Model deployment
8. llama.cpp integration
9. Inference routing
10. Failure recovery
11. Compute accounting
12. Dashboard

Do not skip ahead to later phases until the current phase works.

## Important

The goal is a working hackathon MVP, not a production-scale cloud platform.

When suggesting an implementation, prioritize:

1. correctness
2. simplicity
3. demonstrability
4. deployability
5. extensibility