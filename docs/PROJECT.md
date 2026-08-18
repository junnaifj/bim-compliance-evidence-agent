# Evidence Agent project architecture

Evidence Agent follows one auditable path: authenticated model intake → human-approved rule package → deterministic execution → GlobalId-linked 3D evidence → human review → verified report export.

## Authority boundaries

- `core/compliance` owns IFC evidence, thresholds, status and deterministic priority.
- `core/rules` turns authorised source passages into draft packages; a person confirms every entry.
- `core/agent` may explain, extract and propose. OpenAI output is schema-bound and checked for unknown identifiers, verdicts, priorities and numerical claims.
- `core/review` stores human dispositions separately from immutable machine verdicts.
- `core/reports` converts natural language into an editable scope. Markdown, JSON and print/PDF exports derive from the same verified finding set.

`FAIL` means confirmed non-compliance. `REVIEW` means evidence or applicability requires professional judgement and must never be presented as either failure or pass. Nominal `IfcDoor.OverallWidth` remains proxy evidence rather than confirmed clear-opening width.

## Published scope

The repository contains two executable demonstration rules, three licensed public IFC samples, a manual IFC fixture, source-document parsing, selectable rule packages, a real IFC viewer, human review, optional OpenAI assistance and bilingual verified reports. It is a professional pre-review prototype rather than statutory certification software.

Behavioural ideas from candidate submissions were independently reimplemented. No candidate code, branding or unlicensed asset is included.
