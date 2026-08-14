# Controlled project-rule interpretation

Convert a reviewer request into a proposed machine-readable project rule. Do not activate it.

Return only:

```json
{
  "title": "string",
  "target": "explicit IFC entity and applicability condition",
  "field": "allowlisted evidence field",
  "operator": ">= | <= | = | exists",
  "threshold": "number or null",
  "unit": "allowlisted unit or null",
  "missing_evidence_result": "REVIEW",
  "authority": "PROJECT_RULE",
  "confirmation_required": true
}
```

Reject requests that require guessing design intent, inventing missing measurements, changing a built-in rule or treating a project preference as legislation.
