# Evidence Agent

**An evidence-first IFC compliance pre-review agent.** Upload a model, run two deterministic checks, inspect every decision against its IFC evidence, compare revisions and ask the Agent to turn a natural-language project requirement into a rule proposal that only becomes active after human confirmation.

> Evidence Agent is a technical-assessment prototype. It supports professional pre-review; it does not certify statutory compliance or replace a suitably qualified reviewer.

## Why this prototype exists

BIM compliance tools often fail in one of two ways: they produce a confident verdict from incomplete model data, or they use an LLM where a reproducible rule is required. Evidence Agent treats uncertainty as a first-class result.

- Deterministic code owns `PASS`, `FAIL`, `REVIEW` and `NOT_APPLICABLE`.
- A nominal `IfcDoor.OverallWidth` is labelled as a proxy; it cannot silently become a clear-opening measurement.
- Missing exit-door applicability remains `REVIEW`; names and geometry are not used to guess design intent.
- The Agent explains evidence, asks for missing information and proposes controlled project rules. It cannot rewrite findings.

## Assessment scope

The prototype implements two built-in checks:

| Rule | Purpose | Assessment parameter |
| --- | --- | --- |
| `EGRESS-WIDTH-001` | Check the evidenced clear width of explicitly confirmed exit doors | 900 mm demonstration threshold |
| `INFO-001` | Check door name, applicability, width provenance and fire-rating evidence | Evidence-completeness policy |

The 900 mm threshold demonstrates the checking architecture. It is not presented as a universally applicable statutory requirement.

## Product capabilities

- IFC2x3 and IFC4 STEP upload, processed locally in the browser.
- A compact evidence map with finding selection and GlobalId traceability.
- Explicit reliability states: `EXPLICIT`, `PROXY`, `MISSING` and `DERIVED`.
- A four-state finding model that separates uncertainty from failure.
- GlobalId-based comparison of two model revisions.
- Natural-language project-rule interpretation with a mandatory human confirmation gate.
- Faithful English and Chinese Markdown reports.
- Three assessment scenarios: revised clinic, failing baseline and evidence gaps.
- A 225 KB official buildingSMART IFC4 sample as a licensed no-door negative control.
- Responsive, keyboard-accessible interface with no API key required for the deterministic demonstration.

## Quick start

Requirements: Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

Open the local URL shown in the terminal. Select **Harbour Clinic · R02**, run the evidence review, inspect a `FAIL` or `REVIEW` finding, compare R01 with R02, then propose a 950 mm project rule in **Rule studio**.

## Verification

```bash
npm run build
npm test
npm run lint
```

## Repository structure

```text
app/                  Product interface
lib/compliance.ts     Normalised evidence, deterministic rules and IFC intake
prompts/              Agent, project-rule and report contracts
examples/             Small IFC fixtures and provenance notes
docs/                 Architecture and assessment mapping
tests/                Deployed-render smoke tests
.openai/hosting.json  Sites deployment metadata
```

## IFC boundary

The current browser slice extracts a controlled subset of IFC STEP evidence: schema, project, storey count, `IfcDoor` identity, name and nominal width. Uploaded `OverallWidth` values remain proxies. The visual evidence map is explicitly abstract and does not claim to reconstruct IFC geometry.

A production implementation should place IfcOpenShell or web-ifc behind the same normalised evidence contract to resolve property sets, units, spatial relationships and geometry. This honest boundary is preferable to fabricating positions or treating nominal dimensions as verified clear openings.

## Agent boundary

The checked-in prompts are public and reviewable. The hosted assessment path uses a deterministic local interpreter, so the walkthrough cannot fail because of a missing model API. A production LLM adapter may replace the interpreter only if it returns the same allowlisted structure, preserves the confirmation gate and never receives verdict authority.

## Privacy and security

- Uploaded models remain in the browser session and are not persisted by the application.
- No API key is required or accepted by the assessment interface.
- IFC input is treated as untrusted text; the prototype does not execute embedded content.
- Reports contain derived findings and identifiers, so reviewers should still follow the project information-security policy.

## Further reading

- [Architecture](docs/ARCHITECTURE.md)
- [Assessment mapping](docs/ASSESSMENT_MAPPING.md)
- [Agent system prompt](prompts/system.md)
- [Controlled rule prompt](prompts/interpret-project-rule.md)
- [Faithful report prompt](prompts/report.md)

## Licence

Code is released under the MIT Licence. External sample models retain their original licences and attribution.
