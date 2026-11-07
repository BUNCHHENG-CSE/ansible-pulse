# TCT AnsiblePulse
### Observability Layer for Fragmented Ansible & IaC Scripts

[![Status](https://img.shields.io/badge/status-production--ready-emerald)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16%20%28App%20Router%29-black)](#)
[![Bun](https://img.shields.io/badge/runtime-Bun%20v1.4-orange)](#)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%20v6-blue)](#)
[![Neon](https://img.shields.io/badge/Production%20DB-Neon%20Serverless%20Postgres-00E599)](#)
[![SQLite](https://img.shields.io/badge/Local%20DB-SQLite%203-003B57)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

---

## 🎯 The Core Problem

The primary challenge with Ansible and Infrastructure as Code (IaC) in growing organizations is **not writing playbooks**, but **cross-project, cross-team script fragmentation**:

- **Duplicate Drift**: The exact same function (e.g. Docker engine setup, Nginx proxy configuration, user provisioning) is written in 3–5 slightly different versions by different engineers across multiple repositories.
- **Active Version Invisibility**: No visibility into which version is actively executing in staging or production versus dormant, abandoned copies.
- **Invisible Blast Radius**: When an engineer modifies a shared base role (e.g. security hardening, kernel sysctl), there is zero visibility into how many downstream playbooks and production clusters will break.
- **Zombie Core Dependencies**: High-impact roles referenced across the company that have sat unmaintained for over a year because the original author left and nobody has time to audit them.

> **Target Users**: Organizations using Ansible or similar IaC tools with **5+ person platform, DevOps, or SRE teams**.  
> **Philosophy**: **Read-Only Observability**. Does not execute or modify any script—pure visibility via static AST parsing, Git metadata, and CI log ingestion.  
> **Pricing**: **$99–$249/month per team**, anchored to preventing a single production outage caused by playbook version confusion or replacing weeks of manual script audits.

---

## 🏗️ Architecture & Engine Components

```
TCT AnsiblePulse Architecture
┌────────────────────────────────────────────────────────────────────────┐
│                        Data Ingestion Layer                            │
│  ┌───────────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ YAML AST Parser       │  │ Git History      │  │ CI/CD Execution │  │
│  │ (Plays, Tasks, Roles, │  │ (Commits, Churn, │  │ Log Ingestion   │  │
│  │  Modules, Parameters) │  │  Authors, Decay) │  │ (Status, Recency│  │
│  └───────────┬───────────┘  └────────┬─────────┘  └────────┬────────┘  │
└──────────────┼───────────────────────┼─────────────────────┼───────────┘
               ▼                       ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Analytics & Intelligence                        │
│  ┌─────────────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Duplicate & Divergence  │  │ Blast Radius   │  │ Multi-Factor    │  │
│  │ Detector (Side-by-side  │  │ DAG Engine     │  │ Risk Scorer     │  │
│  │  parameter comparison)  │  │ (Transitive)   │  │ (Zombie Cores)  │  │
│  └─────────────────────────┘  └────────────────┘  └─────────────────┘  │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Presentation Layer                           │
│  ┌─────────────────────────┐                  ┌─────────────────────┐  │
│  │ CLI Tool (`cli.py`)     │                  │ Modern Web UI (SPA) │  │
│  │ (Audits, JSON, CI gates)│                  │ (FastAPI + React TS)│  │
│  └─────────────────────────┘                  └─────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Static YAML AST Parser (`yaml_parser.py`)**:
   - Safe Ansible loader ignoring `!vault` and unquoted tags.
   - Normalizes FQCNs (`ansible.builtin.apt` → `apt`).
   - Extracts module calls, parameters, task dependencies, handlers, tags, and conditionals.
2. **Duplicate & Divergence Detector (`duplicate_detector.py`)**:
   - Task & role fingerprinting across repositories.
   - Generates exact **Side-by-Side Parameter Diff Matrices** (highlights identical, differing values, and missing keys).
   - Identifies the **Recommended Canonical Version** for consolidation.
3. **Blast Radius & Dependency DAG (`blast_radius.py`)**:
   - Builds directed acyclic graph (DAG) across playbooks, roles, and task files.
   - Computes transitive downstream impact: *"If I change this role, which 4 playbooks and production environments are affected?"*
4. **Git History & Churn Miner (`git_miner.py`)**:
   - Calculates days since last commit, commit velocity (90 days), churn lines, and distinct author count.
5. **Execution History Parser (`ci_log_parser.py`)**:
   - Ingests Ansible CLI output, ARA, and CI/CD logs to detect active versus dormant versions and last execution health (`SUCCESS`, `CHANGED`, `FAILED`).
6. **Risk Intelligence Scorer (`risk_scorer.py`)**:
   - **Zombie Core Flag**: Blast Radius $\ge 3$ + Staleness $\ge 180$ days.
   - **Drifted Fork Flag**: Near-identical code with parameter divergence across teams.
   - **Hot Churn Flag**: High commit volatility across $\ge 3$ authors with CI failures.
7. **Security & Compliance Linter (`security_linter.py`)**:
   - Detects plaintext secrets & unencrypted credentials in parameters (`SEC001`).
   - Flags world-writable file permissions e.g. `mode: 0777` (`SEC002`).
   - Identifies unverified remote downloads and `curl | bash` piping (`SEC003`).
   - Detects non-idempotent raw command/shell execution where native modules exist (`SEC004`).
   - Computes platform-wide Security Compliance Score (0–100) and letter grade (A–F).
8. **Automated Canonical Remediation & Patch Synthesizer (`remediation_engine.py`)**:
   - Automatically consolidates divergent duplicate tasks into a standardized **Canonical Ansible Role**.
   - Extracts divergent parameters into clean `defaults/main.yml` variables.
   - Synthesizes a ready-to-commit **Unified Git Patch** (`.patch`) for downstream consumer repos.
9. **Executive Audit Report Generator (`report_generator.py`)**:
   - Generates standalone, presentation-ready audit briefs in Markdown, styled printable HTML/PDF, and JSON.
10. **Zero-Configuration Dual-Engine Storage (`session.py`)**:
   - Seamlessly uses PostgreSQL 16 container when available, or transparently falls back to embedded SQLite (`ansible_pulse.db`) with zero setup.

---

## ⚡ Quickstart (Next.js All-in-One Full-Stack)

TCT AnsiblePulse is converted into a **modern Next.js 16 full-stack application** powered by **Bun**, featuring TypeScript App Router API routes, Tailwind CSS v4, and dual Prisma database support (**SQLite** for zero-config local development and **Neon Serverless PostgreSQL** for production).

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+) or Node.js (v18+)

### 1. Install & Run
```bash
# Clone and enter directory
cd "Observability Layer for Fragmented Ansible  IaC Scripts"

# Install dependencies with Bun
bun install

# Start development server
bun run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 2. Dual Database Architecture (Local SQLite & Production Neon)

TCT AnsiblePulse operates with dual-mode Prisma configuration:

| Environment | Database | Configuration |
| :--- | :--- | :--- |
| **Local Development** | **Embedded SQLite** (`ansible_pulse.db`) | Default zero-config in `.env`: `DATABASE_URL="file:./ansible_pulse.db"` |
| **Production** | **Neon Serverless PostgreSQL** | Set in production: `DATABASE_URL="postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"` |

#### Switching & Generating Prisma Client
The custom generator `scripts/prisma-gen.js` detects your target database automatically:
```bash
# Auto-detects based on DATABASE_URL in .env:
bun run prisma:generate

# Explicitly generate for local SQLite:
bun run prisma:generate:sqlite

# Explicitly generate for production Neon PostgreSQL:
bun run prisma:generate:neon

# Push schema changes to Neon production:
bun run prisma:push:neon
```

### 3. Build & Production Start
```bash
# Build optimized production bundle
bun run build

# Start production server
bun run start
```

---

## 🐍 Python Engine & CLI Quickstart (Legacy / Standalone)

### 1. Setup Environment
```bash
# Clone and enter directory
cd "Observability Layer for Fragmented Ansible  IaC Scripts"

# Create virtual environment & install requirements
python -m venv .venv
.\.venv\Scripts\pip install fastapi uvicorn pydantic pyyaml pytest httpx sqlalchemy "psycopg[binary]" psycopg2-binary
```

### 2. Start Production PostgreSQL in WSL Docker (Local DB)
TCT AnsiblePulse is optimized with a production-tuned PostgreSQL 16 container running in WSL Docker with connection pooling, custom memory buffers, and GIN JSONB parameter indexing:
```powershell
# From Windows PowerShell:
.\scripts\wsl_docker_db.ps1 start

# Or directly in WSL:
bash scripts/wsl_docker_db.sh start

# Verify database health & pool status (10ms latency):
.\.venv\Scripts\python cli.py db-status
```

### 3. Generate Demo Enterprise Repositories
The testbed includes 4 realistic multi-repo company projects (`platform-core-infra`, `ecommerce-frontend`, `data-pipeline-k8s`, `payments-gateway`) with simulated git commit histories and execution logs:
```bash
.\.venv\Scripts\python backend/scripts/setup_demo_repos.py
```

### 4. Run the CLI Scanner
Audit repositories directly from your terminal (automatically persists to PostgreSQL):
```bash
# Scan demo repositories (persists scan run to database)
.\.venv\Scripts\python cli.py scan --demo

# Inspect security anti-patterns and CIS compliance grade
.\.venv\Scripts\python cli.py security --demo

# Synthesize canonical consolidated role and git patch for duplicate clusters
.\.venv\Scripts\python cli.py remediate --demo --output-dir ./canonical_roles

# Generate executive governance audit report (Markdown or HTML)
.\.venv\Scripts\python cli.py report --demo --format markdown --output audit_report.md

# Enforce CI/CD Quality Gate policies in pull request pipelines
.\.venv\Scripts\python cli.py gate --demo --min-health 70 --min-security 70

# View historical scan audits from database
.\.venv\Scripts\python cli.py db-history

# Inspect high-risk governance assets
.\.venv\Scripts\python cli.py risks --demo

# Simulate blast radius impact of a specific asset
.\.venv\Scripts\python cli.py blast-radius --demo --asset "platform-core-infra::roles/common_base/tasks/main.yml"
```

### 5. Launch the Web Dashboard
```bash
.\.venv\Scripts\python cli.py serve --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser! Shows live PostgreSQL health indicator in the navbar with historical scan audits.

---

## 🖥️ Web Dashboard Features

| View | Purpose |
| :--- | :--- |
| **📊 Executive Overview** | Fleet health score (0–100), critical risk alerts, KPI summary cards, and governance health indicators. |
| **🔍 Duplicate Map** | Semantic functional clusters with side-by-side parameter matrices and 1-click **Canonical Role & Patch Synthesizer**. |
| **💥 Blast Radius DAG** | Interactive topology network. Click any node to illuminate its downstream dependent playbooks and production targets. |
| **⚠️ High-Risk Radar** | Focuses on unmaintained Zombie Core assets, drifted forks, and abandoned dependencies with actionable remediation suggestions. |
| **🛡️ Security & Compliance** | Static analysis detecting hardcoded secrets, world-writable file modes, unverified downloads, and compliance letter grade (A–F). |
| **📦 Script Inventory** | Searchable catalog of all playbooks, roles, and tasks with execution status, git authors, staleness, and line-level AST inspection. |
| **🧪 Live Impact Simulator** | Modal that simulates the blast radius of any change before touching code. |
| **📑 Executive Audit Report** | Management-ready PDF/Markdown report generator with scorecards, risk registry, and 30-60-90 day consolidation roadmap. |
| **🚦 CI/CD Quality Gate** | Interactive policy simulator and GitHub Actions step generator to block pull requests with Zombie Core dependencies. |
| **💰 Value & ROI Calculator** | Interactive model proving the business case ($99–$249/mo vs cost of 1 playbook outage or manual audit FTE). |

---

## 🧪 Running Automated Tests

Run the full end-to-end test suite:
```bash
.\.venv\Scripts\pytest -v tests/test_observability.py
```
**Test Coverage Includes:**
- ✅ Safe YAML AST parsing and role reference extraction
- ✅ Duplicate task clustering and parameter divergence diffing
- ✅ Blast radius DAG transitive propagation
- ✅ Critical Zombie Core asset detection
- ✅ Blast impact simulator
- ✅ All FastAPI REST API endpoints

---

## 💼 Business Model & Customer Validation

- **Target Persona**: Platform Engineering Lead, Head of Infrastructure, Lead SRE.
- **Validation Question**:
  > *"When did running the wrong version of an Ansible playbook last cause a staging drift or production problem? How many playbooks across teams do similar things?"*
- **Response Guide**:
  - If they answer: *"We roughly know, but nobody has time to clean it up"*, they have acute pain and are ready for **TCT AnsiblePulse**.
  - If they answer: *"We have a single monorepo with 100% review enforcement"*, they are outside the target segment.
- **Pricing Strategy**: **$99/month (Standard)** for teams up to 10 engineers; **$249/month (Enterprise)** for larger multi-cluster platform teams.
