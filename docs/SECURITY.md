# Security and privacy

- IFC and uploaded rule-source files are processed in the browser and are not persisted by the hosted assessment application.
- Project memory uses device-local storage and can be erased from the Agent workspace.
- The browser never asks for an API key. Optional model providers require an operator-managed server connector.
- File extensions are allow-listed, size is bounded and malformed IFC input fails closed.
- Extracted document text is untrusted. It can create only `DRAFT` candidate rules.
- Verdicts are deterministic; natural-language text cannot override rule code.
- Reports are checked against structured findings for identifiers and numerical claims before download.
- Official government documents are linked rather than redistributed.

Production multi-tenant use would additionally require authenticated storage isolation, malware scanning, retention controls, an SSRF-safe import service, encrypted secrets, cost limits and a formal DPIA.

