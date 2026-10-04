# Aurevix Research Foundations

This note captures the research directions that informed the current investor-facing hardening work. It is intentionally conservative: list only sources and themes we can credibly point to when explaining why Aurevix uses explicit review gates, uncertainty surfacing, richer policy guardrails, and honest simulation language.

## What this update used from the research

- Human video understanding is useful for extracting **semantic intent**, but monocular video should not be treated as robot-grade geometry by default.
- Modern robotics systems increasingly separate:
  - learned semantic interpretation,
  - deterministic validation,
  - and human approval for deployment.
- Industrial UX should show **uncertainty, review-required states, and operator guardrails** directly in the workflow rather than hiding them behind a polished animation.
- Reactive task logic matters, but a full behavior-tree migration is not required to start benefiting from:
  - preconditions
  - fallback paths
  - review-required nodes
  - explicit guarded steps

## Product decisions supported by this research

The current implementation work in Aurevix uses these research-backed principles:

1. **Do not overclaim simulation fidelity.**
   - The viewport and exported simulator are positioned as visual review plus heuristic validation, not as a full digital twin.

2. **Expose uncertainty directly in the operator experience.**
   - Steps now carry confidence, guard status, review requirements, and fallback guidance.

3. **Use BT-like execution semantics incrementally.**
   - Instead of rewriting the product around full behavior trees immediately, Aurevix adds step-level preconditions, fallback labels, and guarded review states.

4. **Keep deterministic validation in the loop.**
   - Reachability and clearance guardrails remain explicit before trust approval and export.

5. **Keep learned outputs reviewable.**
   - Model-derived or vision-dependent steps are surfaced as requiring review rather than silently treated as final truth.

## Curated source categories

These are the categories we should cite in customer and investor conversations. Where possible, prefer the primary paper or official documentation rather than summaries.

### 1. Video understanding and robot imitation

- Vision-language-action systems and video-to-robot planning
- Hierarchical imitation from human video
- Temporal action segmentation for long-horizon tasks

Use these to support:
- semantic intent extraction from demonstrations
- the need for temporal structure beyond naive frame differencing
- the separation between semantic task understanding and physical execution

### 2. Open-vocabulary perception and scene grounding

- Open-vocabulary segmentation and video tracking
- Monocular depth estimation
- Pose estimation for manipulation

Use these to support:
- confidence-aware scene grounding
- visual review of low-confidence geometry
- why monocular evidence should still be treated cautiously

### 3. Reactive policy representations

- Behavior trees for manipulation
- task-and-motion planning
- skill graphs / precondition-effect execution models

Use these to support:
- guarded steps
- retry/fallback semantics
- human-readable execution logic

### 4. Industrial validation and trust

- explainable robotics
- human oversight and trust calibration
- industrial robot safety and deployment review

Use these to support:
- operator review gates
- clearer readiness evidence
- the distinction between AI assistance and qualified deployment approval

## Customer-safe messaging

When discussing this work externally, use wording like:

- “Aurevix uses recent robotics research as design input, especially around uncertainty-aware robot teaching, operator review, and human-in-the-loop deployment validation.”
- “We deliberately separate AI interpretation from deployment approval and keep qualified review in the loop.”
- “The simulator and viewport are designed for transparent review and planning support; final deployment still requires explicit evidence and human approval.”

Avoid saying:

- “Aurevix fully simulates real-world execution.”
- “The AI automatically proves a deployment is safe.”
- “Monocular video alone gives exact robot-grade geometry.”

## Next research-backed upgrades we can pursue

- Better object-centric prompting and keyframe extraction on Apple Silicon
- Richer task logic and guarded execution flow
- Stronger symbolic validation before export
- More structured perception evidence and correction workflows

## Evidence hygiene

Before using any paper in customer-facing material:

1. Prefer the original paper, proceedings page, or official project page.
2. Avoid relying on blog summaries, ResearchGate mirrors, or SEO explainers.
3. Record exactly which product decision the source informed.
