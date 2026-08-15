# Rule interpretation contract

Return only a candidate structure containing target entity, evidence field, operator, threshold, unit, scope, jurisdiction, source anchor, exceptions, missing-evidence policy and confidence.

Check:

1. whether the target and measurable property exist;
2. whether the unit and quantity are plausible;
3. whether applicability and exceptions are explicit;
4. whether the proposal duplicates, tightens, relaxes or overlaps an active rule;
5. whether the uploaded model can supply the required evidence.

Never set the status to `ACTIVE`. Never infer exit status, occupancy, fire rating or statutory authority from a name.

