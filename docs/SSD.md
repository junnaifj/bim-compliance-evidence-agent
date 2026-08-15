# System Sequence Design and Test Method · SSD v1.5

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
    V->>V: Index storey containment without changing IFC placement coordinates
    U->>V: Enter, hover or select an IFC element
    V->>V: Build reviewed hit stack and cycle through occluded candidates
    V-->>U: Retain all reviewed colours until selection; isolate and filter by GlobalId after selection
    U->>V: Filter a storey, click a finding, or request next FAIL / REVIEW
    V-->>U: Fly to the same GlobalId and expose its evidence explanation
    U->>O: Add a review disposition, note or corrected evidence value
    O->>X: Validate type, unit, plausible range, provenance and required reason
    X-->>H: Preview original value, proposed effective value and affected findings
    H-->>O: Confirm or cancel
    O->>E: Re-run affected rules against versioned effective evidence
    E-->>V: Preserve machine verdict and attach human disposition / override provenance
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
23. Storey-index tests link elements through `IfcRelContainedInSpatialStructure` by GlobalId, retain unassigned elements, and prove that storey filtering never rewrites geometry coordinates.
24. Review-queue tests cover status and storey filters, findings-row reverse selection, `F` next FAIL, `R` next REVIEW, wrap-around and no-result behaviour; shortcuts are ignored while typing in an input or textarea.
25. Evidence-explanation tests require the displayed observation, threshold, deficit, unit, source anchor, reliability and human-review reason to match the selected structured finding exactly.
26. Rule-source extraction retains page anchors. Executable numerical candidates, structurable incomplete candidates and reference-only passages remain distinct and none activates automatically.
27. PDF retry tests upload the same file twice, clear the input value after each attempt and verify that a first technical failure cannot poison the second attempt.
28. PDF health tests distinguish worker unavailable, scanned/no-text, encrypted/copy-restricted, readable/no-rule and draft-rule outcomes; the UI never labels a technical failure as “no applicable rules”.
29. Deployment provenance tests expose a non-secret build identifier and worker health state, and fail when the HTML/JavaScript bundle and static PDF worker are not from the same build.
30. Clean-room reference test: no candidate source code, branding, benchmark section or unlicensed asset is present; only independently implemented interaction behaviours may be reproduced.
31. Human-review schema tests keep `machineStatus` immutable and store `reviewDisposition`, reviewer, note, timestamp and version separately.
32. Evidence-override tests preserve the original IFC value, require provenance and reason where applicable, validate units/ranges, produce an impact preview and apply only after explicit confirmation.
33. Recalculation tests prove that an approved clear-width or exit-applicability override updates the affected element findings, marks the evidence `HumanEvidence.<provenance>` and retains the prior evidence in history.
34. Undo and restore tests recover the previous effective evidence and finding state without mutating the uploaded IFC source.
35. Review-selection tests cover finding selection, per-element human disposition and correction history; human actions cannot directly change a numerical machine verdict.
36. Report tests disclose original evidence, effective evidence, machine verdict and human disposition. `ACCEPTED_WITH_NOTE` and `MANUALLY_EXCLUDED` can never be rendered as a machine PASS.
37. Agent-action tests require a structured preview and human confirmation before any conversation-derived review record or evidence override is committed.
38. Composer tests cover multiline input, Enter send, Shift+Enter newline, selected-element context, attachment context and accessible agent/model menus.
39. Agent/model selection tests distinguish role, provider and execution mode. Disabled/unconfigured models cannot be selected and the recorded model must match the actual execution path.
40. Conversation safety tests block prompt injection, direct verdict mutation, credential requests, silent provider fallback and actions targeting a GlobalId outside the current model.
41. Project-memory tests persist review records, override history, conversation, selector preferences and undo data, while clear-memory removes them all.

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
- Candidate repositories without an explicit licence are behavioural references only; their code, assets and copy are not imported.
- Page text and extracted clauses retain document/page provenance and remain data, never instructions to the Agent.
- Human review is a disposition layer, not permission to rewrite deterministic machine verdicts.
- Conversation-derived changes remain proposed actions until a human confirms the exact target, value, provenance and impact.
- Browser forms never accept API keys. A ChatGPT or Codex session is not represented as an API provider credential.
- Provider/model labels must report the execution route truthfully; unavailable providers cannot silently fall back while retaining their label.

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
| Review queue | Results can be filtered by status and storey. Clicking a result focuses and selects the same GlobalId. `F` and `R` advance through FAIL and REVIEW findings with wrap-around and do not fire while the user types. |
| Storey scope | Storey membership is derived from IFC containment relationships. Filtering changes visibility/opacity only and does not translate or rotate model geometry. Unassigned elements remain discoverable in the whole-model scope. |
| Why this result | The selected-element inspector reproduces the finding's observation, requirement, deficit, evidence source, rule anchor, reliability and review note without recomputation or invented values. |
| PDF worker | The configured worker is present in the production assets and is initialised before parsing; missing or blocked assets produce a visible technical error rather than a false “no rules” result. |
| Rule source | CSV sample previews and yields an anchored draft. PDF upload exposes page/character/worker/hash evidence and a page-anchored catalogue of executable, structurable or reference-only passages. Technical failure, no text and no executable rule are different outcomes. No draft activates without a user choice. |
| PDF retry | Selecting the same PDF again always starts a fresh read. A failed worker attempt cannot leave a stale empty catalogue or prevent retry. |
| Deployment identity | The Sources view exposes a short build identifier and worker health result so an obsolete deployment can be distinguished from the tested repository revision. |
| Human review | Each finding independently shows its immutable machine verdict and versioned human disposition. Reviewer, timestamp and note are visible and auditable. |
| Evidence override | Original IFC evidence is always visible. A corrected value requires source metadata, validation, an impact preview and explicit confirmation before becoming effective evidence. |
| Recalculation | Confirmed overrides re-run the deterministic review against the effective model, label new evidence `HumanEvidence.<provenance>`, update the map/list/report consistently and retain the prior evidence in history. |
| Undo | Undo and restore return to the exact previous effective evidence and review output without changing the IFC byte source. |
| Review selection | Users can select a model element or finding, save a separate human disposition, and inspect correction history. Human review cannot directly edit engineering verdicts. |
| Agent composer | The Agent workspace uses one persistent message thread and bottom multiline composer with context chips, attachments, an agent-role menu, a truthful model menu and accessible keyboard behaviour. |
| Agent action | Natural-language review or evidence changes become structured proposed actions. No action is applied before the user confirms its GlobalId, change, source and impact. |
| Model truth | Local deterministic mode is usable by default. Unconfigured external models are disabled with a reason, and every response records the execution mode actually used. |
| Human-aware report | Reports separately disclose machine verdict, original/effective evidence, override provenance and human disposition; human acceptance never becomes machine PASS. |
| IFC coordinates | IFC placements and XYZ geometry remain unchanged and the previous Y-up viewer convention is retained. Only the viewer grid is placed at the model minimum Y, so the model is not displayed below its visual baseline and evidence coordinates remain original. |
| Bilingual | Navigation, workspaces, statuses, errors and report content change together |
| Report | Export is enabled only when numerical and identifier verification succeeds |
| Report Agent | Natural language becomes an editable brief; ordinary use requires no copied prompt; rule-change requests are routed to Rule Studio; deterministic local mode works without an API key |
| Licence | Three published IFC files match the manifest hashes and declared redistribution terms |
| Local official source | The manually downloaded HKSAR document retains its official URL and hash, remains Git-ignored and is never asserted to be redistributable |
