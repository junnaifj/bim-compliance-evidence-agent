# System Sequence Design and Test Method · SSD v1.3

## Runtime SSD

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant V as IFC viewer
    participant O as Orchestrator
    participant D as Document agent
    participant R as Rule agent
    participant H as Human approval
    participant E as Deterministic engine
    participant X as Evidence verifier

    U->>V: Select sample or upload IFC
    V->>V: Parse geometry in the established viewer coordinates and place only the display grid at the model baseline
    U->>D: Upload authorised rule source
    D->>D: Bootstrap and verify the PDF worker
    D-->>U: Original preview + extraction evidence + draft rule catalogue + anchors
    U->>R: Enter or select a proposed rule
    R->>R: Check units, plausibility, scope and active rules
    R-->>H: Replace / retain with scope / cancel
    H-->>R: Explicit decision
    R->>E: Versioned ACTIVE rule only
    U->>O: Run evidence review
    O->>E: Normalised model evidence + active rules
    E-->>V: Findings linked by GlobalId
    U->>V: Enter, hover or select an IFC element
    V->>V: Build reviewed hit stack and cycle through occluded candidates
    V-->>U: Retain all reviewed colours until selection; isolate and filter by GlobalId after selection
    E->>X: Structured findings JSON
    U->>O: Describe the report in natural language
    O-->>U: Editable, plain-language report brief
    U->>H: Confirm the brief
    H->>X: Generate from findings only
    X-->>U: Verified bilingual report or blocked export
```

## Quality gates

Every change runs, in order:

1. ESLint.
2. Strict TypeScript compilation.
3. Production build.
4. Boundary and unit tests.
5. Real IFC sample regressions.
6. Rule conflict and approval-state tests.
7. Document and prompt-injection tests.
8. Numerical and identifier hallucination mutation tests.
9. Licence, attribution and SHA-256 tests.
10. Server-render smoke tests.
11. Viewer interaction reducer and selected-GlobalId filter tests.
12. Report-intent routing, editable-brief and rule-change hand-off tests.
13. Browser diagnostics for hover, selection, blank-click/Escape clearing and reverse selection.
14. Multi-hit ray selection: a reviewed internal element behind an unreviewed shell wins; the nearest ordinary element is used only when no reviewed candidate exists.
15. Visual-compositor tests for normal, discovery, hovered and selected states, including reviewed-element colour retention and selected-element isolation.
16. Pointer-move throttling and material-allocation regression checks on the larger Clinic model.
17. Runtime material-state assertion: the number of status-coloured meshes equals the number of reviewed GlobalIds that have geometry; entering the canvas cannot grey a reviewed mesh.
18. Occlusion regression: a reviewed internal door remains reachable when an unreviewed shell or another reviewed element is in front; repeated clicks at the same screen point cycle through distinct reviewed GlobalIds.
19. PDF worker asset gate: the production build serves the configured worker URL, initialisation happens before `getDocument`, and the four-page official fixture yields its expected hash, page count and non-zero extracted character count.
20. PDF outcome-state tests distinguish `EXTRACTION_ERROR`, `TEXT_EXTRACTED_NO_RULES` and `DRAFT_RULES_EXTRACTED`; none may silently activate a rule.
21. IFC coordinate tests preserve every placed XYZ vertex exactly and retain the established Three.js Y-up camera/grid convention; only the viewer grid is moved to the model minimum Y, without rotating or translating the model root.
22. Browser regressions run against both a built-in IFC and `manual-test-files/ifc/IfcOpenHouse.ifc`, including coloured discovery, deep selection, grid alignment and PDF upload.

Deployment requires the complete `npm run quality` gate.

## Sensitive testing

- IFC, document and file-name text is untrusted and never executed.
- Prompt-injection prose cannot create an active rule.
- DWG is rejected with a truthful conversion requirement.
- Unsupported, disguised and malformed files fail closed.
- Project memory cannot activate a rule and exposes deletion.
- API credentials are not accepted in the browser.
- A ChatGPT or Codex login is never treated as an OpenAI API credential; an optional LLM document provider must be server-side, explicitly configured and independently billed.
- OCR or LLM-extracted passages remain untrusted draft evidence. They cannot alter deterministic findings, thresholds or active rules without human approval.
- Unknown numerical claims and GlobalIds block report export.
- Report chat cannot alter an active rule, override a verdict or disclose credentials.
- Requests to change thresholds are handed to Rule Studio for conflict checking and human approval.
- Long, HTML-bearing and prompt-injection inputs are treated as untrusted text.
- Sample redistribution fails CI if source, licence, permission or hash is absent.

## Numerical hallucination method

The report verifier builds an allow-list from structured finding counts, thresholds, observations, derived deficits, trusted element names, evidence paths and identifiers. It normalises metre claims to millimetres. The report is then scanned for claims outside that allow-list.

Mutation tests alter `900 mm` to `990 mm`, replace a GlobalId, remove expected evidence, change REVIEW to PASS and invent summary totals. Each mutation must block export. Equivalent `0.9 m` and `900 mm` claims are normalised before comparison. Proxy dimensions can never be promoted to clear-width evidence. This guards invented values, changed verdicts and false certainty while permitting grounded dimensions already present in a model element name.

## Acceptance matrix

| Area | Acceptance |
| --- | --- |
| IFC | IFC2x3 Duplex and Clinic entity counts match; IFC4 negative control creates no invented doors |
| Rule boundary | 899 mm fails, 900 mm passes, 901 mm passes where clear width and applicability are explicit |
| Uncertainty | OverallWidth proxy and missing applicability remain `REVIEW` |
| Viewer | Real geometry loads; orbit, pan, zoom, X-ray and section operate. Entering the canvas colours all reviewed geometry and dims only unreviewed geometry; selection greys non-targets and filters findings; blank click/Escape clears; a findings-row click selects the model element. |
| Discovery layer | While the pointer is over the model, every reviewed element retains its status colour and all unreviewed geometry becomes transparent grey. A hovered reviewed element receives an additional emphasis without hiding other reviewed elements. |
| Internal picking | Ray hits form a de-duplicated reviewed-first stack. Transparent shells cannot block reviewed geometry; repeated clicks at the same point cycle through distinct reviewed internal elements. The nearest ordinary element is used only when no reviewed candidate exists. |
| Selected isolation | The selected element remains coloured and opaque; every other element, including other reviewed elements, becomes transparent grey until clear, blank click or Escape. |
| PDF worker | The configured worker is present in the production assets and is initialised before parsing; missing or blocked assets produce a visible technical error rather than a false “no rules” result. |
| Rule source | CSV sample previews and yields an anchored draft. PDF upload exposes page/character extraction evidence and one of three explicit outcomes: technical failure, readable with no executable candidates, or draft candidates. No draft activates without a user choice. |
| IFC coordinates | IFC placements and XYZ geometry remain unchanged and the previous Y-up viewer convention is retained. Only the viewer grid is placed at the model minimum Y, so the model is not displayed below its visual baseline and evidence coordinates remain original. |
| Bilingual | Navigation, workspaces, statuses, errors and report content change together |
| Report | Export is enabled only when numerical and identifier verification succeeds |
| Report Agent | Natural language becomes an editable brief; ordinary use requires no copied prompt; rule-change requests are routed to Rule Studio; deterministic local mode works without an API key |
| Licence | Three published IFC files match the manifest hashes and declared redistribution terms |
| Local official source | The manually downloaded HKSAR document retains its official URL and hash, remains Git-ignored and is never asserted to be redistributable |
