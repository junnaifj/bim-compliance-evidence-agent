# Security and privacy

- IFC and uploaded rule-source files are processed in the browser and are not persisted by the hosted assessment application.
- Project memory uses device-local storage and can be erased from the Agent workspace.
- OpenAI is optional. It can use an operator-managed server secret or a user-supplied session key. A session key is masked, held only in React memory and sent to a fixed OpenAI endpoint through a same-origin, no-store server route. It is never persisted in storage, cookies, logs, files or traces.
- Raw IFC and rule-source documents are excluded from model requests. Only bounded structured findings, rule metadata, the question and recent messages are sent.
- Agent routes enforce same-origin requests, actual body-size limits, a per-client rate limit, model allow-format validation, fixed upstream URLs, timeouts and sanitised upstream errors.
- File extensions are allow-listed, size is bounded and malformed IFC input fails closed.
- Extracted document text is untrusted. It can create only `DRAFT` candidate rules.
- Verdicts are deterministic; natural-language text cannot override rule code.
- Reports are checked against structured findings for identifiers and numerical claims before download.
- Official government documents are linked rather than redistributed.

Production multi-tenant use would additionally require authenticated storage isolation, malware scanning, retention controls, an SSRF-safe import service, encrypted secrets, cost limits and a formal DPIA.
