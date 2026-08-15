# Architecture

## Design principle

Evidence Agent separates semantic assistance from verdict authority. Agent output can create a draft, explanation or proposed scope. Only versioned deterministic code can create a compliance status, and only a human can activate or supersede a project rule.

```mermaid
flowchart LR
    U[User workspace] --> O[Review orchestrator]
    O --> I[Model intake]
    O --> D[Document intelligence]
    O --> R[Rule conflict and feasibility]
    H[Human approval] --> R
    R --> C[Versioned rule catalogue]
    I --> E[Deterministic compliance engine]
    C --> E
    E --> V[Evidence verifier]
    E --> G[IFC geometry viewer]
    V --> P[Bilingual report]
    O <--> M[Project memory]
    O --> T[Auditable event trace]
    O --> A[Optional OpenAI Responses API]
    A --> X[Strict structured-output verifier]
```

## Evidence contract

The stable join key is IFC GlobalId. An element also retains its STEP express ID for geometry lookup. Every finding includes the rule ID and version, observed and required values, evidence path, reliability classification and next step.

Reliability states are `EXPLICIT`, `PROXY`, `MISSING` and `DERIVED`. A proxy cannot silently be promoted to explicit evidence.

## Viewer

The browser uses web-ifc WASM to stream IFC product meshes into Three.js. Geometry is not fabricated from parser counts. Picking, status colours and focus use the same GlobalId as the result list. Model bytes remain in the browser session.

## Rule lifecycle

```text
DRAFT → NEEDS_DECISION → VALIDATED → ACTIVE → SUPERSEDED
```

Conflict analysis distinguishes duplicate, stricter, looser and overlapping rules. Approval can replace the active rule, retain both with distinct scope, or cancel. Active records are preserved rather than overwritten.

## Memory and providers

Session context, approved project rules and audit decisions are separated. This assessment build stores project memory locally on the device and provides a clear action to erase it. Provider selection does not change deterministic findings. OpenAI may use an operator-managed server secret or a user-supplied session key. The session key is held only in component memory and is never persisted or recorded. Other provider connectors are labelled as planned and cannot be selected.

The OpenAI route sends bounded structured context—not IFC/PDF bytes—to the Responses API with `store: false`. A four-step maximum tool loop exposes only read and proposal tools. Strict Structured Outputs are parsed and then independently checked against current GlobalIds, verdicts, evidence paths and numerical allow-lists. A rejected or unavailable response is labelled and handled by the local deterministic fallback; it cannot change state.

The transparent trace shows plan, tool, decision and guardrail events. It does not expose or claim to expose hidden chain-of-thought.

## Copyright boundary

Hong Kong Government sources are registered by official URL and publisher. The public repository does not redistribute the full documents. An authorised local copy may be uploaded for private preview and candidate-rule extraction.
