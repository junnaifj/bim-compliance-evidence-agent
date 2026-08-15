# Evidence Agent

Evidence Agent is an evidence-first BIM compliance workspace for IFC pre-review. It combines a real browser-based IFC viewer, deterministic compliance rules, document-to-rule extraction, human approval, project memory, revision comparison and numerically guarded bilingual reports.

> The application supports professional pre-review. It does not certify statutory compliance or replace approved plans or a suitably qualified professional.

## Assessment path

The complete demonstration works without an API key:

1. Load the small, licensed **Duplex residence** sample or upload an IFC2x3/IFC4 file.
2. Orbit, pan and zoom the real IFC geometry; use X-ray and section controls.
3. Run two deterministic checks and select a finding to focus its IFC element by GlobalId.
4. Propose a natural-language rule. The Agent checks feasibility and the active catalogue before asking whether to replace the existing rule, keep both with distinct scope, or cancel.
5. Upload a PDF, DOCX, XLSX, CSV, IDS, IFC, DXF or text rule source. Preview it and send extracted numerical clauses to conflict review.
6. Inspect the plan–act–verify trace, project memory and provider registry.
7. Generate an English or Chinese report. Export is enabled only after every identifier and numerical claim passes verification.

## Deterministic rules

| Rule | Evidence policy |
| --- | --- |
| `EGRESS-WIDTH-001` | Applies only where exit-door applicability is explicit. `Pset_DoorCommon.ClearWidth` may pass or fail; nominal `IfcDoor.OverallWidth` remains a proxy and therefore `REVIEW`. The 900 mm value is an assessment parameter, not a universal statutory threshold. |
| `INFO-001` | Checks door name, applicability, width provenance and fire-rating evidence for confirmed exits. Missing information is `REVIEW`, never an invented failure or pass. |

LLMs may explain, extract and suggest. They never own `PASS`, `FAIL`, `REVIEW` or `NOT_APPLICABLE`.

## Real assessment samples

The product contains no candidate benchmark section. Three open-source models cover fast interaction, performance and negative applicability:

- xeokit Duplex residence — Apache-2.0, 14 doors and 21 spaces.
- BSI (2020) Medical-Dental Test Files, buildingSMART International — CC BY 4.0, 254 doors and 269 spaces.
- buildingSMART PCERT Architecture — CC BY 4.0 IFC4 negative control.

See [`public/samples/manifest.json`](public/samples/manifest.json) for exact source URLs, licences, hashes and expected counts. CI verifies every redistributed byte.

## Rule sources and copyright

The Hong Kong Buildings Department and Development Bureau entries are official links. Their full documents are not copied into this public repository because government copyright terms restrict republication. Users may upload an authorised copy for private, in-browser preview and extraction.

Extracted clauses remain `DRAFT`. A source page, sheet or text segment is retained, and a user must approve any activation.

## Agent architecture

- Review Orchestrator — bounded plan and hand-offs.
- Model Intake — schema, units, entity and GlobalId evidence.
- Document Intelligence — private parsing and candidate-rule extraction.
- Rule Agent — conflict, plausibility, scope and unit checks.
- Deterministic Rule Engine — verdict authority.
- Evidence Verifier — identifier and numerical guardrail.
- Report Agent — faithful English, Chinese or prompt-based narrative.

Project memory is device-local, inspectable and erasable. It stores approved rules and decisions, never API keys, and cannot bypass approval. Optional provider entries are deliberately separated from rule truth; the local path always remains available.

## Development

Requires Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

Quality gates:

```bash
npm run quality
```

The command runs linting, strict type checking, a production build and the complete deterministic test suite. The same gate runs on every push and pull request.

## Repository map

```text
app/                         Bilingual product interface
components/IfcViewer.tsx     Real web-ifc + Three.js evidence viewer
lib/compliance.ts            IFC evidence, rules, conflicts, reports and guardrails
lib/document-intelligence.ts Rule-source parsing and official-source registry
lib/memory.ts                Device-local project and audit memory
lib/agent.ts                 Provider registry and transparent orchestration trace
public/samples/               Licensed real IFC assessment models
prompts/                      Public Agent contracts
tests/                        Boundary, sample, security, licence and hallucination tests
docs/                         Architecture, SSD and assessment evidence
```

## Licence

Application code is MIT licensed. External IFC models and web-ifc retain their own licences and attribution; see `licences/` and the sample manifest.

