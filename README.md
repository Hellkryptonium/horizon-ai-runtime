# Horizon AI Runtime

### Distributed AI Compute, Powered by Everyone.

**Team:** Multi Horizon

---

## 1. Overview

Horizon AI Runtime is a distributed AI inference platform that allows developers to deploy AI models onto compatible compute resources contributed by participating machines.

Instead of requiring every AI developer to purchase or rent dedicated cloud infrastructure, Horizon AI Runtime creates a shared pool of available CPU, RAM, GPU and VRAM resources.

The platform automatically discovers workers, evaluates their available resources, schedules workloads, routes inference requests, detects worker failures, redeploys workloads when possible, and tracks verified compute contribution.

### Core idea

```text
Idle Compute
      ↓
Worker Network
      ↓
Resource-aware Scheduler
      ↓
AI Model Runtime
      ↓
Inference
      ↓
Compute Credits
```

---

# 2. Problem

Deploying modern AI models can require significant CPU, RAM, GPU and VRAM resources.

Students, researchers, independent developers and early-stage startups frequently face:

* Free cloud tiers have limited resources.
* GPU infrastructure can be expensive.
* Large models may work locally but fail during cloud deployment.
* Managing model-serving infrastructure requires additional DevOps knowledge.
* Personal computers and workstations often have unused compute capacity.
* There is no simple mechanism for pooling heterogeneous machines into an AI inference network.

This creates an infrastructure mismatch:

```text
AI developers need compute
          +
Machines have unused compute
          ↓
   Horizon AI Runtime
```

---

# 3. Solution

Horizon AI Runtime creates a distributed compute layer for AI inference.

A participant explicitly installs a Worker Agent on their machine.

The Worker Agent discovers and reports:

* CPU cores
* RAM
* GPU
* VRAM
* Operating system
* CPU architecture
* Availability
* Current resource utilization

The Control Plane maintains a registry of workers and schedules model deployments based on resource requirements.

Developers interact with the platform through the Horizon API instead of managing individual machines.

```text
Developer
    ↓
Horizon API
    ↓
Deployment Manager
    ↓
Resource-aware Scheduler
    ↓
Compatible Worker
    ↓
Model Runtime
    ↓
Inference Response
```

---

# 4. MVP Goal

The MVP demonstrates a complete distributed AI deployment lifecycle:

```text
Worker Registration
        ↓
Hardware / Resource Discovery
        ↓
Worker Authentication
        ↓
WebSocket Connection
        ↓
Heartbeat
        ↓
Model Deployment
        ↓
Resource-aware Scheduling
        ↓
DeepSeek 7B-class Inference
        ↓
Request Routing
        ↓
Worker Failure Detection
        ↓
Model Redeployment
        ↓
Compute Accounting
        ↓
Compute Credits
```

The MVP uses a small network of trusted, team-controlled machines, including macOS and Windows systems.

### MVP success criteria

The MVP is considered successful when we can:

1. Register multiple physical machines.
2. Detect their resources.
3. Keep workers online through heartbeats.
4. Schedule a model to a compatible worker.
5. Start the model runtime through Docker.
6. Run a DeepSeek 7B-class quantized model.
7. Send inference requests through the Control Plane.
8. Detect when the selected worker disappears.
9. Select another compatible worker.
10. Redeploy the model.
11. Continue inference through the same API.
12. Record compute usage.
13. Award internal compute credits.

---

# 5. Non-Negotiable MVP Architecture Rules

These rules apply throughout MVP development.

1. The Control Plane is a **modular monolith**.
2. The Worker Agent never connects directly to PostgreSQL.
3. Workers communicate with the Control Plane through HTTPS and WebSocket.
4. Workers never receive `DATABASE_URL`.
5. One model instance runs entirely on one worker.
6. The MVP does **not** use model parallelism.
7. Model weights are never stored in PostgreSQL.
8. Model workloads run through controlled containers.
9. Worker resource limits must be enforced.
10. The scheduler is deterministic.
11. Microservices are excluded from the MVP.
12. Kubernetes is excluded from the MVP.
13. Kafka is excluded from the MVP.
14. Redis is excluded unless a concrete MVP requirement appears.
15. Blockchain is excluded from the MVP.
16. Real cryptocurrency is excluded from the MVP.
17. Public/untrusted workers are excluded from the MVP.
18. The Control Plane must never provide arbitrary shell execution to workers.
19. Do not introduce new infrastructure unless it solves an actual MVP requirement.
20. Do not implement future roadmap features before the current MVP milestone works.

The goal is:

> **Correctness → Demonstrability → Simplicity → Deployability → Extensibility**

---

# 6. Architecture

```text
                              ┌──────────────────┐
                              │     Next.js      │
                              │     Dashboard    │
                              └────────┬─────────┘
                                       │
                                     HTTPS
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Horizon Control │
                              │      Plane       │
                              │                  │
                              │ API              │
                              │ Worker Registry  │
                              │ Model Registry   │
                              │ Scheduler        │
                              │ Deployments      │
                              │ Jobs             │
                              │ Health           │
                              │ Credits          │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Neon PostgreSQL  │
                              └──────────────────┘
                                       ▲
                                       │
                              Control Plane only
                                       │
                         HTTPS / WebSocket
                                       │
              ┌────────────────────────┼───────────────────────┐
              │                        │                       │
              ▼                        ▼                       ▼
        ┌────────────┐          ┌────────────┐          ┌────────────┐
        │  Worker A  │          │  Worker B  │          │  Worker C  │
        │    Mac     │          │    Mac     │          │  Windows   │
        └─────┬──────┘          └─────┬──────┘          └─────┬──────┘
              │                       │                       │
              ▼                       ▼                       ▼
           Docker                  Docker                  Docker
              │                       │                       │
              ▼                       ▼                       ▼
        llama.cpp               llama.cpp               llama.cpp
              │                       │                       │
              ▼                       ▼                       ▼
          AI Model                 AI Model                 AI Model
```

---

# 7. Architecture Style

The MVP uses a **Modular Monolith** for the Control Plane.

The backend is one deployable application but is internally divided into independent modules.

```text
Control Plane
│
├── workers
├── models
├── deployments
├── scheduler
├── jobs
├── health
└── credits
```

Each module should follow:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Database
```

Business logic must not be placed directly inside routes.

### Why modular monolith?

It provides:

* Clear separation of responsibilities.
* Easy local development.
* Easy deployment.
* Simple debugging.
* Low infrastructure overhead.
* A clean path toward future service separation if required.

Microservices are intentionally excluded from the MVP.

---

# 8. Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Control Plane

* Node.js
* TypeScript
* Express
* Drizzle ORM

## Database

* PostgreSQL
* Neon

## Worker Agent

MVP:

* Node.js
* TypeScript

Future:

* Go-based Worker Agent

## Model Runtime

* llama.cpp
* GGUF

## AI Model

Primary demonstration:

* Quantized DeepSeek 7B-class model

## Infrastructure

* Docker
* HTTPS
* WebSocket

---

# 9. Repository Structure

```text
horizon-ai-runtime/
│
├── apps/
│   ├── web/
│   │
│   └── control-plane/
│       └── src/
│           ├── config/
│           ├── db/
│           ├── middleware/
│           ├── modules/
│           │   ├── workers/
│           │   ├── models/
│           │   ├── deployments/
│           │   ├── scheduler/
│           │   ├── jobs/
│           │   ├── health/
│           │   └── credits/
│           │
│           ├── app.ts
│           └── server.ts
│
├── workers/
│   └── agent/
│       └── src/
│           ├── config.ts
│           ├── hardware.ts
│           ├── registration.ts
│           ├── websocket.ts
│           ├── heartbeat.ts
│           ├── docker.ts
│           ├── deployments.ts
│           └── index.ts
│
├── packages/
│   ├── types/
│   ├── validation/
│   └── config/
│
├── models/
│   └── registry/
│
├── docs/
│   ├── worker-protocol.md
│   ├── database.md
│   ├── scheduler.md
│   ├── deployment.md
│   └── worker-installation.md
│
├── docker/
│
├── .github/
│   └── copilot-instructions.md
│
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 10. Worker Agent

The Worker Agent is installed explicitly by a compute provider on their own machine.

The MVP uses trusted team-controlled machines.

The Worker Agent is responsible for:

1. Detecting system resources.
2. Registering the worker.
3. Authenticating with the Control Plane.
4. Maintaining a WebSocket connection.
5. Sending heartbeats.
6. Receiving deployment instructions.
7. Starting controlled model containers.
8. Stopping workloads.
9. Reporting runtime health.
10. Reporting resource usage.
11. Reporting completed jobs.
12. Gracefully shutting down workloads.

Example worker registration:

```json
{
  "name": "mac-01",
  "cpu_cores": 10,
  "ram_mb": 16384,
  "gpu": "Apple Silicon",
  "vram_mb": 0,
  "architecture": "arm64",
  "os": "macos"
}
```

---

# 11. Worker Installation

## MVP

The Worker Agent is manually installed on trusted team machines.

During development, it may be run through the monorepo:

```bash
pnpm --filter worker-agent dev
```

The worker requires:

```text
Node.js
Docker
Network connectivity
Horizon worker credentials
```

The worker must never receive:

```text
DATABASE_URL
Neon credentials
PostgreSQL credentials
```

It only receives credentials required to authenticate with the Control Plane.

---

## Future Worker Distribution

Once the Worker Agent is stable, it can be distributed as a standalone executable.

Potential installation methods:

### macOS

```bash
brew install horizon-worker
```

### Windows

```powershell
winget install MultiHorizon.HorizonWorker
```

### Linux

```bash
curl -fsSL https://horizon.ai/install.sh | sh
```

These installers are **not part of the initial MVP critical path**.

The runtime must work before building polished installers.

---

# 12. Worker Lifecycle

```text
INSTALLING
    ↓
REGISTERING
    ↓
ONLINE
    ↓
BUSY
    ↓
ONLINE
    ↓
OFFLINE
```

Startup lifecycle:

```text
Worker starts
     ↓
Load configuration
     ↓
Load authentication credentials
     ↓
Detect hardware
     ↓
Register with Control Plane
     ↓
Open WebSocket
     ↓
Send heartbeat
     ↓
Wait for commands
```

Shutdown:

```text
Shutdown requested
     ↓
Stop accepting new workloads
     ↓
Gracefully stop active workloads
     ↓
Notify Control Plane
     ↓
Close WebSocket
     ↓
OFFLINE
```

---

# 13. Worker Communication

Workers communicate with the Control Plane through:

* HTTPS for request/response operations.
* WebSocket for persistent worker communication and commands.

Architecture:

```text
Worker
   │
   │ HTTPS
   ▼
Control Plane

Worker
   │
   │ WebSocket
   ▼
Control Plane
```

Workers never connect directly to Neon.

---

# 14. Worker Protocol

The Worker Agent and Control Plane communicate through typed messages.

### Worker → Control Plane

```text
REGISTER
HEARTBEAT
DEPLOYMENT_READY
DEPLOYMENT_FAILED
JOB_STARTED
JOB_COMPLETED
RESOURCE_UPDATE
WORKER_SHUTDOWN
```

### Control Plane → Worker

```text
DEPLOY_MODEL
STOP_MODEL
HEALTH_CHECK
SHUTDOWN_WORKLOAD
```

Example heartbeat:

```json
{
  "type": "HEARTBEAT",
  "workerId": "worker_123",
  "status": "ONLINE",
  "availableRamMb": 8192,
  "cpuUsage": 0.31,
  "activeDeployments": []
}
```

Example deployment command:

```json
{
  "type": "DEPLOY_MODEL",
  "deploymentId": "dep_123",
  "modelId": "deepseek-7b"
}
```

The Control Plane sends structured commands rather than arbitrary shell commands.

---

# 15. Worker Heartbeats

Workers periodically send heartbeat messages.

```text
Worker
   ↓
Heartbeat
   ↓
Control Plane
```

The heartbeat contains:

* Worker status
* Current resource usage
* Active deployments
* Runtime health
* Timestamp

If heartbeats stop for a configured timeout:

```text
ONLINE
   ↓
Heartbeat timeout
   ↓
OFFLINE
```

The Control Plane then evaluates whether affected deployments require recovery.

---

# 16. Resource Limits

Workers must not allow Horizon workloads to consume the entire host machine.

The provider should eventually be able to configure:

```text
Maximum CPU:       50%
Maximum RAM:       8 GB
GPU:               Enabled
Maximum workloads: 1
Run while idle:    Yes
```

The Worker Agent and Docker runtime must respect configured resource limits.

This is required even for the MVP.

---

# 17. Resource-aware Scheduler

The scheduler matches model requirements against worker capabilities.

Example model requirement:

```json
{
  "min_ram_mb": 8192,
  "min_cpu": 4,
  "requires_gpu": false,
  "min_vram_mb": 0,
  "architecture": "arm64"
}
```

The scheduler filters workers by:

1. Online status
2. CPU availability
3. RAM availability
4. GPU availability
5. VRAM availability
6. Architecture
7. Current utilization

The MVP uses a deterministic resource-matching algorithm.

The scheduler must not make opaque or random decisions.

Future versions can incorporate:

* Latency
* Reputation
* Energy cost
* Price
* Historical reliability

---

# 18. Model Runtime

The MVP uses llama.cpp for local LLM inference.

Models are represented by metadata in the Model Registry.

Example:

```text
Model:
    DeepSeek 7B

Format:
    GGUF

Quantization:
    4-bit

Runtime:
    llama.cpp

Minimum RAM:
    Configured by deployment profile
```

The actual model weights are stored outside PostgreSQL and cached locally on workers.

PostgreSQL stores metadata and state, not large model files.

---

# 19. Important Model Architecture Decision

A model instance runs entirely on one worker.

The MVP does **not** split a model across multiple machines.

The five machines form a pool of independent workers.

```text
                    Compute Pool
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      Worker A       Worker B       Worker C
          │              │              │
       Model A        DeepSeek        Model B
```

This avoids the network latency and synchronization complexity associated with distributed model parallelism.

---

# 20. Database Schema

The MVP uses Neon-hosted PostgreSQL through Drizzle ORM.

Core tables:

```text
users
workers
models
deployments
jobs
resource_usage
credit_transactions
```

## Workers

```text
id
userId
name
status
cpuCores
totalRamMb
availableRamMb
gpu
vramMb
architecture
operatingSystem
lastHeartbeat
createdAt
updatedAt
```

## Models

```text
id
name
runtime
image
modelUrl
minCpu
minRamMb
requiresGpu
minVramMb
architecture
createdAt
```

## Deployments

```text
id
modelId
workerId
status
endpoint
createdAt
updatedAt
```

## Jobs

```text
id
deploymentId
workerId
status
startedAt
completedAt
latencyMs
```

## Resource Usage

```text
id
workerId
jobId
cpuSeconds
gpuSeconds
ramGbSeconds
durationSeconds
createdAt
```

## Credit Transactions

```text
id
workerId
jobId
amount
reason
createdAt
```

Credit ledger updates should use PostgreSQL transactions.

---

# 21. Database Security Boundary

Workers never connect directly to PostgreSQL.

Correct:

```text
Worker
   ↓
HTTPS / WebSocket
   ↓
Control Plane
   ↓
Neon PostgreSQL
```

Incorrect:

```text
Worker
   ↓
DATABASE_URL
   ↓
Neon
```

The database credentials remain exclusively within the Control Plane environment.

---

# 22. State Machines

## Worker

```text
ONLINE
BUSY
OFFLINE
```

## Deployment

```text
PENDING
   ↓
SCHEDULING
   ↓
DEPLOYING
   ↓
READY
```

Failure:

```text
READY
   ↓
Worker unavailable
   ↓
DEGRADED
   ↓
SCHEDULING
   ↓
DEPLOYING
   ↓
READY
```

Other terminal states:

```text
STOPPING
STOPPED
FAILED
```

## Job

```text
QUEUED
   ↓
RUNNING
   ↓
COMPLETED
```

Failure:

```text
RUNNING
   ↓
FAILED
```

Do not introduce additional states unless required by an actual implementation need.

---

# 23. Deployment Workflow

### Step 1

Developer registers a model.

### Step 2

Developer requests deployment.

### Step 3

Control Plane retrieves model requirements.

### Step 4

Scheduler searches compatible workers.

### Step 5

A worker is selected.

### Step 6

Control Plane sends a structured deployment command.

### Step 7

Worker starts the model runtime.

### Step 8

Worker reports runtime health.

### Step 9

Deployment becomes `READY`.

### Step 10

Inference requests are routed to the worker.

```text
Client
   ↓
Horizon API
   ↓
Deployment Registry
   ↓
Selected Worker
   ↓
Model Runtime
   ↓
AI Response
```

---

# 24. Docker Runtime

The Worker Agent uses Docker to isolate model runtimes.

Architecture:

```text
Host OS
   │
   ├── Horizon Worker Agent
   │
   └── Docker
         │
         └── Model Container
               │
               └── llama.cpp
                     │
                     └── DeepSeek GGUF
```

The Control Plane must not issue arbitrary Docker or shell commands.

Instead:

```text
DEPLOY_MODEL
     ↓
Worker validates deployment
     ↓
Worker constructs approved runtime configuration
     ↓
Docker container starts
```

The Worker Agent owns the translation from structured deployment instructions to local Docker operations.

---

# 25. Inference Routing

The browser communicates with the Control Plane.

The Control Plane determines which worker currently hosts the deployment.

```text
Browser
   ↓
Control Plane
   ↓
Deployment Registry
   ↓
Worker
   ↓
llama.cpp
   ↓
DeepSeek
   ↓
Worker
   ↓
Control Plane
   ↓
Browser
```

The client does not need to know the physical worker identity.

This abstraction is important for failure recovery.

---

# 26. Failure Recovery

If a worker hosting a model becomes unavailable:

```text
Worker
   ↓
Heartbeat timeout
   ↓
OFFLINE
   ↓
Deployment DEGRADED
   ↓
Scheduler searches for replacement
   ↓
Compatible Worker
   ↓
Model startup
   ↓
Health check
   ↓
READY
```

The deployment's worker assignment is updated.

The client continues communicating with the Control Plane.

The client does not need to know which physical worker is currently serving the model.

---

# 27. Compute Credits

Compute providers receive internal compute credits for verified successful workloads.

The MVP uses an internal PostgreSQL ledger rather than blockchain.

```text
Worker
   ↓
Job completed
   ↓
Usage recorded
   ↓
Compute Units calculated
   ↓
Credit transaction created
```

Possible inputs:

```text
CPU time
GPU time
RAM usage
Job duration
Successful completion
```

Example:

```text
Compute Units =

    CPU seconds × CPU weight
  + GPU seconds × GPU weight
  + RAM GB-seconds × RAM weight
```

The reward formula remains configurable.

The underlying usage information must be stored so rewards can be audited.

---

# 28. Security

The MVP operates on team-controlled machines, but basic security requirements still apply.

### MVP requirements

* Worker authentication
* No direct database access
* Resource limits
* Controlled Docker workloads
* Secrets isolation
* Structured worker commands
* No arbitrary remote shell execution
* Explicit worker shutdown
* Model/runtime health checks

### Future public-network requirements

A public worker network would additionally require:

* Strong container isolation
* Network restrictions
* Image verification
* Malicious workload prevention
* Worker reputation
* Result verification
* Strong workload authentication
* Better secret management
* Abuse prevention

The platform must not execute arbitrary untrusted workloads directly on host systems.

---

# 29. Environment Variables

The Control Plane may have:

```env
DATABASE_URL=
PORT=
CORS_ORIGIN=
WORKER_AUTH_SECRET=
```

The frontend may have:

```env
NEXT_PUBLIC_API_URL=
```

The Worker Agent may have:

```env
CONTROL_PLANE_URL=
WORKER_TOKEN=
```

### Critical rule

Workers must never receive:

```env
DATABASE_URL=
```

`.env` files containing secrets must never be committed to Git.

---

# 30. Deployment Strategy

The project is designed to be deployable from the beginning.

## Control Plane

Deploy as a single Node.js service.

Possible hosting:

* Render
* Railway
* Fly.io
* Other suitable Node.js hosting

The MVP does not require Kubernetes.

## Frontend

Deploy the Next.js application.

Possible hosting:

* Vercel
* Other suitable Next.js hosting

## Database

Use Neon PostgreSQL.

## Workers

Run on participating physical machines.

```text
Cloud
│
├── Frontend
├── Control Plane
└── Neon PostgreSQL

Team / Provider Machines
│
├── Worker 1
├── Worker 2
├── Worker 3
├── Worker 4
└── Worker 5
```

---

# 31. Neon + Drizzle Workflow

Neon is the hosted PostgreSQL provider.

Drizzle is the database ORM and migration layer.

Development workflow:

```text
Schema change
     ↓
Drizzle schema
     ↓
Generate migration
     ↓
Run migration
     ↓
Neon PostgreSQL
```

Neon branches may be used for isolated development environments.

Production schema changes should go through migrations rather than manually modifying production tables.

---

# 32. MVP Development Order

This is the authoritative implementation order.

## Phase 1 — Foundation

1. Monorepo
2. Control Plane
3. Express
4. TypeScript
5. Environment configuration
6. Drizzle
7. Neon PostgreSQL
8. `GET /health`

### Milestone

```text
Control Plane starts
        +
Database connection works
        +
Health endpoint works
```

---

## Phase 2 — Worker Registry

9. `workers` table
10. Worker schema
11. Worker repository
12. Worker service
13. Worker controller
14. `POST /api/workers/register`
15. `GET /api/workers`

### Milestone

```text
POST /workers/register
        ↓
Neon
        ↓
GET /workers
        ↓
Worker appears
```

This is the first major MVP milestone.

---

## Phase 3 — Worker Agent

16. Worker Agent package
17. Hardware discovery
18. Worker authentication
19. Registration
20. WebSocket connection
21. Heartbeats
22. Resource updates
23. Offline detection

### Milestone

```text
Real Mac / Windows machine
        ↓
Worker Agent
        ↓
Control Plane
        ↓
Neon
```

---

## Phase 4 — Model Runtime

24. Model Registry
25. DeepSeek model metadata
26. Docker runtime
27. llama.cpp
28. GGUF model
29. Model startup
30. Model health checks

### Milestone

```text
Worker
   ↓
Docker
   ↓
llama.cpp
   ↓
DeepSeek
   ↓
Inference
```

---

## Phase 5 — Scheduler

31. Resource requirement schema
32. Worker filtering
33. Deterministic worker selection
34. Deployment creation
35. Deployment state machine
36. Worker deployment command

### Milestone

```text
Deploy DeepSeek
      ↓
Scheduler
      ↓
Compatible Worker
      ↓
Model READY
```

---

## Phase 6 — Inference

37. Inference endpoint
38. Request routing
39. Job creation
40. Job status
41. Response handling
42. Streaming if practical

### Milestone

```text
Browser
   ↓
API
   ↓
Worker
   ↓
DeepSeek
   ↓
Response
```

---

## Phase 7 — Failure Recovery

43. Heartbeat timeout
44. Worker OFFLINE
45. Deployment DEGRADED
46. Replacement worker selection
47. Model redeployment
48. Health verification
49. Deployment READY

### Milestone

```text
Worker A
   ↓
KILL
   ↓
OFFLINE
   ↓
Scheduler
   ↓
Worker B
   ↓
DeepSeek
   ↓
READY
```

---

## Phase 8 — Compute Accounting

50. Resource usage
51. Compute unit calculation
52. Credit transaction ledger
53. Provider balance
54. Usage history

### Milestone

```text
Job
 ↓
Usage
 ↓
Compute Units
 ↓
Credit Transaction
```

---

## Phase 9 — Dashboard

55. Worker dashboard
56. Worker status
57. Resource usage
58. Deployment dashboard
59. Model status
60. Inference interface
61. Compute credits

---

## Phase 10 — Final Demo

Connect:

```text
Mac 1        ONLINE
Mac 2        ONLINE
Mac 3        ONLINE
Windows 1    ONLINE
Windows 2    ONLINE
```

Show:

```text
5 Workers
~60 GB Aggregate RAM
```

Important:

> The machines are independent workers. Aggregate RAM does not mean one model has access to 60 GB of unified memory.

Then:

```text
Deploy DeepSeek
      ↓
Scheduler selects compatible worker
      ↓
Inference works
      ↓
Stop selected worker
      ↓
Heartbeat timeout
      ↓
Worker OFFLINE
      ↓
Deployment DEGRADED
      ↓
Replacement worker selected
      ↓
Model redeployed
      ↓
Inference works again
      ↓
Credits displayed
```

---

# 33. Development Rules for GitHub Copilot

Copilot should use this README as the high-level source of truth.

Before implementing a feature, Copilot should:

1. Inspect the existing repository.
2. Inspect this README.
3. Inspect `.github/copilot-instructions.md`.
4. Reuse existing types and utilities.
5. Avoid introducing unnecessary dependencies.
6. Avoid creating new infrastructure.
7. Follow the modular architecture.
8. Keep business logic in services.
9. Keep database operations in repositories.
10. Validate external input.
11. Keep worker and Control Plane responsibilities separate.
12. Add tests for important business logic.
13. Explain major architectural decisions before making them.

Copilot must not:

* Introduce microservices.
* Introduce Kubernetes.
* Introduce Kafka.
* Introduce Redis without an explicit requirement.
* Introduce blockchain.
* Split models across workers.
* Put database credentials on workers.
* Create arbitrary remote shell execution.
* Store model weights in PostgreSQL.
* Implement future roadmap features prematurely.
* Rewrite working architecture without a concrete reason.

---

# 34. Documentation Structure

As implementation grows, maintain:

```text
docs/
├── worker-protocol.md
├── database.md
├── scheduler.md
├── deployment.md
└── worker-installation.md
```

### worker-protocol.md

Documents WebSocket messages and worker communication.

### database.md

Documents tables, relationships, indexes and migrations.

### scheduler.md

Documents resource matching and worker selection.

### deployment.md

Documents deployment state transitions and runtime lifecycle.

### worker-installation.md

Documents local installation, Docker requirements and future package distribution.

---

# 35. MVP Scope Boundary

## Included

* Worker registration
* Hardware discovery
* Authentication
* Heartbeats
* Resource monitoring
* Deterministic scheduling
* Model deployment
* Docker runtime
* llama.cpp
* DeepSeek 7B-class inference
* Request routing
* Failure detection
* Model redeployment
* Job tracking
* Resource usage
* Compute credits
* Dashboard
* Multiple physical workers

## Explicitly excluded

* Model training
* Distributed model parallelism
* Kubernetes
* Microservices
* Kafka
* Blockchain
* Real cryptocurrency
* Public worker marketplace
* Arbitrary user workloads
* Trustless proof-of-compute
* Complex autoscaling
* Multi-region infrastructure
* Advanced distributed consensus

---

# 36. Future Roadmap

## Phase 1 — MVP

* Worker registration
* Heartbeats
* Resource discovery
* Scheduler
* DeepSeek inference
* Deployment management
* Failure recovery
* Compute credits

## Phase 2

* GPU scheduling
* Better model registry
* Worker reputation
* Model caching
* Improved monitoring
* Go-based Worker Agent
* Native worker binaries
* Homebrew distribution
* Windows installer

## Phase 3

* Public worker onboarding
* Strong workload isolation
* Autoscaling
* Multiple model replicas
* Advanced scheduling
* Worker resource policies

## Phase 4

* Decentralized compute marketplace
* On-chain settlement
* Tokenized compute credits
* Advanced verification

---

# 37. Project Vision

Horizon AI Runtime aims to make AI infrastructure more accessible by turning unused compute into a shared resource.

```text
Idle Compute
      ↓
Distributed Worker Network
      ↓
Resource-aware AI Runtime
      ↓
Affordable AI Inference
```

### Tagline

> **Turn idle compute into an AI cloud.**

### Hackathon demonstration statement

> **The model doesn't belong to one machine. It belongs to the network.**

If a worker disappears, the Control Plane detects the failure, finds another compatible worker, redeploys the model and restores the deployment without requiring the client to know which physical machine is running it.
