# Behavioural reference review

This project was independently implemented after reviewing the documented behaviour of `fsb-door-check` at commit `960bcafa9870586634c0d3c85bcf1911c8b47e70`.

The useful product principles were:

- stable IFC GlobalIds across the viewer, findings and exports;
- a navigable review queue with model focus and storey context;
- visible evidence provenance and a plain-language explanation of each verdict;
- immediate visual refresh after a human-approved rule or evidence change.

The implementation deliberately does not reproduce that repository's source code, interface copy or visual design. No root licence was present at the reviewed commit. This repository therefore uses a clean-room implementation and retains its own visual system.

It also keeps stricter semantics than the reference:

- `REVIEW` and `NOT_APPLICABLE` remain separate;
- all IFC elements with stable identifiers are pickable, not doors alone;
- repeated ray picks can reach internal elements behind a shell;
- IFC placement coordinates are preserved without an axis remap;
- an LLM cannot activate rules, change deterministic verdicts or invent missing evidence.

Reference: <https://github.com/WateryWaterman/-HKU-AI-Agent-Technical-Test-SFS_HKU/tree/960bcafa9870586634c0d3c85bcf1911c8b47e70/fsb-door-check/docs>

The reporting workflow was also behaviourally reviewed against `Mickey12go/bim-compliance-checker`. The transferable principle is that deterministic findings own factual truth while an LLM turns those findings into a readable professional report, with a local fallback and a numerical-faithfulness check. Evidence Agent extends that division with selectable report scope, per-finding or summary detail, separate human-review disclosure and English, Chinese or paired bilingual output.

The reference is MIT licensed, but this project still uses an independent implementation and imports no source, branding, templates or assets.

Reference: <https://github.com/Mickey12go/bim-compliance-checker>
