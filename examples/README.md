# Samples

`assessment-door-sample.ifc` is a deliberately small, hand-authored IFC4 STEP fixture for upload-path regression. It contains a project, one storey and three doors. It is not an architectural model and must not be used as evidence of geometry support.

## Official external negative-control sample

`buildingsmart-pcert-architecture.ifc` is the 225,635-byte IFC4 PCERT architecture scene published by buildingSMART International in its official [Sample-Test-Files repository](https://github.com/buildingSMART/Sample-Test-Files/tree/main/IFC%204.0.2.1%20(IFC%204)/PCERT-Sample-Scene).

- Source revision inspected: repository `main`, 15 August 2026.
- SHA-256: `3ff9b10bd00c7b96dded51e7ca5a6b69efbea38b049adcdd05fcd247de7e70d5`.
- Licence: Creative Commons Attribution 4.0 International; copyright buildingSMART International Ltd.
- Purpose: safe parser and empty-applicability control. The scene contains one storey and no `IfcDoor` occurrences, so the correct result is an empty door inventory rather than invented findings.

This negative control complements the tiny door fixture and demonstrates that the application does not fabricate review targets when an IFC contains no applicable elements.
