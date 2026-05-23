# FORGE MIND — Investor Pitch Deck

> *Teach a cobot in under 3 hours. No code. No integrator.*

---

## Slide 1 — Cover

**FORGE MIND**
AI-Powered Robot Teaching for Manufacturers

*Seed Round — $1.2M*

---

## Slide 2 — The Problem

### Industrial automation is broken for 90% of manufacturers

- **250,000+ SME manufacturers** in North America alone are unable to afford traditional robot integration
- A typical robotic cell integration costs **$10,000–$20,000** and takes **4–8 weeks**
- Retraining a robot for a new part or product line costs nearly as much as the initial integration
- The result: SMEs skip automation entirely — and fall further behind larger competitors

> *"We bought the robot. It sat in the corner for six months waiting for the integrator."*
> — Production Manager, Tier-2 auto supplier

---

## Slide 3 — The Solution

### FORGE MIND: Video-guided robot teaching in under 3 hours

1. **Show** — Operator records a video demonstration of the task
2. **Speak** — Natural language voice guidance is transcribed and understood
3. **Deploy** — FORGE MIND packages a reusable, versioned *skill* ready for execution

No programming. No integrator. No downtime.

```
Operator shows task on video
         ↓
Whisper transcribes + FORGE MIND embeds (all-MiniLM-L6-v2)
         ↓
Skill stored in PostgreSQL + pgvector semantic index
         ↓
Robot executes skill — quality score tracked per run
```

---

## Slide 4 — Product

### Three core modules

| Module | What it does |
|---|---|
| **Skill Builder** | Record video demos → auto-transcribe → skill ready |
| **Skill Library** | Semantic search across all your robot skills (`pgvector`) |
| **Fleet Manager** | Multi-robot facility dashboard with E-stop + live status |

**Key differentiators:**
- Skills are **portable** — reuse across robot models
- Skills are **versioned** — roll back to a previous version in one click
- Skills are **searchable** — "find me something similar to pick and place" returns AI-ranked results
- **Quality scoring** per demonstration — automatically surface best practice

---

## Slide 5 — Market Opportunity

### The cobot market is inflecting now

| | 2024 | 2030 |
|---|---|---|
| Global cobot market | **$2.1B** | **$12.3B** |
| CAGR | — | ~34% |
| Units shipped (2024) | ~80,000 | ~420,000 |
| Average unit price | ~$30K | ~$25K |

**Serviceable Addressable Market (SAM)**
- Target: facilities with 1–20 cobots in North America + Europe
- ~50,000 facilities × $500/robot/month × avg 3 robots = **$75M ARR at 1% penetration**

**Beachhead:** Tier-2 and Tier-3 automotive suppliers in the US Midwest (10,000+ facilities, $18B addressable)

---

## Slide 6 — Business Model

### SaaS subscription — simple, predictable, hardware-agnostic

| Tier | Price | Includes |
|---|---|---|
| **Starter** | $500/robot/month | 1 facility, unlimited skills, 5 robots |
| **Growth** | $400/robot/month | Up to 5 facilities, priority support |
| **Enterprise** | Custom | White-label, SSO, on-premise option |

**Unit economics (target steady-state):**
- CAC: ~$800 (direct sales via integrator partnerships)
- LTV: ~$36,000 (avg 3 robots × 24-month retention × $500)
- **LTV:CAC ratio: ~45×**

**Additional revenue levers:**
- Professional services: onboarding packs ($2,000 flat)
- Marketplace: sell/license skills between facilities

---

## Slide 7 — Traction

### Early Signals

- ✅ **MVP complete** — Rust API + ML service + Next.js dashboard, production-ready
- ✅ **2 pilot LOIs** from Tier-2 automotive suppliers (combined ~12 robots)
- ✅ **Research partnership** with [University Lab] on quality-scoring models
- 🚀 **Pilot launch Q2 2025** — 5 facilities, 20 robots
- 🎯 **Target**: $50K MRR by end of 2025

---

## Slide 8 — Competitive Landscape

| | FORGE MIND | Wandelbots | Fuzzy Logic | Traditional integrator |
|---|---|---|---|---|
| No-code teaching | ✅ | ✅ | ✅ | ❌ |
| Video-guided | ✅ | ❌ | ❌ | ❌ |
| Semantic skill search | ✅ | ❌ | ❌ | ❌ |
| Multi-brand robots | ✅ | ✅ | ✅ | ✅ |
| SaaS pricing | ✅ | ✅ | ❌ (on-prem) | ❌ |
| SME-accessible price | ✅ | ❌ ($$$) | ✅ | ❌ |

**Our moat:**
1. **Semantic skill library** — pgvector-powered similarity search across your entire teaching history
2. **Quality scoring** — every demonstration graded; best practices surface automatically
3. **Data flywheel** — more skills taught → better embeddings → better similarity search → stickier product

---

## Slide 9 — Technology

### Built for reliability and scale from day one

```
┌─────────────┐    HTTPS/TLS     ┌──────────────────────────────┐
│  Next.js 15 │◄────────────────►│  Rust API (Axum 0.7)         │
│  React 19   │                  │  RS256 JWT · Argon2 · Redis   │
│  TailwindCSS│                  │  rate limiting · row-level    │
└─────────────┘                  │  ownership checks             │
                                 └────────────┬─────────────────┘
                                              │ X-Internal-Secret
                                 ┌────────────▼─────────────────┐
                                 │  ML Service (Python 3.11)     │
                                 │  Whisper · MiniLM-L6-v2       │
                                 │  FastAPI · Redis BRPOP worker │
                                 └────────────┬─────────────────┘
                                              │
                                 ┌────────────▼─────────────────┐
                                 │  PostgreSQL 16 + pgvector     │
                                 │  384-dim semantic embeddings  │
                                 └──────────────────────────────┘
```

**Security posture:** OWASP Top 10 addressed, `cargo audit` + `pip-audit` in CI, zero-wildcard CORS

**Test coverage:**
- 38 Rust integration tests (isolated DB per test via `sqlx::test`)
- 14 Python unit/API tests
- 3 Playwright E2E test suites
- k6 load tests (p95 login <400ms target)

---

## Slide 10 — Team

| Name | Role | Background |
|---|---|---|
| **[Founder]** | CEO / Product | 8 years in industrial automation, ex-[OEM] |
| **[Co-founder]** | CTO | Rust + ML, ex-[robotics company] |
| **[Advisor]** | Robotics | Professor, [University], 20 years cobot research |

*Actively hiring: senior Rust engineer, ML engineer (computer vision)*

---

## Slide 11 — Use of Funds

### $1.2M Seed Round — 18-month runway

| Category | Amount | % |
|---|---|---|
| Engineering (2 × senior engineers) | $600K | 50% |
| Sales & customer success | $240K | 20% |
| Infrastructure & ops | $120K | 10% |
| Marketing & events (trade shows) | $120K | 10% |
| Legal, IP, admin | $120K | 10% |

**Milestones unlocked:**
1. **Month 6** — 20 paying facilities, $20K MRR, Series A process starts
2. **Month 12** — Computer vision quality scoring (reduce demonstration count 3→1)
3. **Month 18** — $100K MRR, skill marketplace beta

---

## Slide 12 — The Ask

### We are raising **$1.2M Seed**

**Lead investor:** seeking $800K lead with board seat
**Co-investors:** $400K remainder open

**What we offer:**
- Access to the 250,000-facility SME manufacturing market before any incumbent notices
- A capital-efficient SaaS moat built on data (every taught skill strengthens our model)
- A team that has lived this problem from the factory floor up

---

*Contact: [founder@forge-mind.dev](mailto:founder@forge-mind.dev)*
*Demo available at: https://demo.forge-mind.dev*
