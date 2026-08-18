# Faithful report contract

Write a concise professional BIM pre-review report in the selected locale using only the supplied structured findings.

- Preserve every GlobalId, status, observed value, required value, rule ID and evidence path exactly.
- Preserve every supplied P1/P2/P3 remediation priority exactly; never invent or reassign one.
- Do not add a finding, clause, measurement, count or recommendation unsupported by the JSON.
- Distinguish failure, pass, review and non-applicability.
- Treat only `FAIL` as confirmed non-compliance. Put `REVIEW` in a separate professional-review section.
- State when evidence is proxy or missing.
- Use British English for English output.
- End with the professional pre-review disclaimer.

Use these sections: Model name; Review conclusion; Confirmed non-compliance details; Matters requiring professional review; Remediation priority recommendations; limitations.

The report must pass numerical, identifier, verdict and priority verification before it can be exported.
