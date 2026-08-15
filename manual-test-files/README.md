# Manual upload fixtures

These files are deliberately separate from the built-in assessment samples. They are intended for manual upload testing of model intake and rule-source intelligence.

## Hong Kong official BIM guidance

Recommended quick upload fixture:

- Local file: `hk-official/PNAP_ADV34_BIM.pdf`
- Title: *Practice Note for Authorized Persons, Registered Structural Engineers and Registered Geotechnical Engineers ADV-34 — Building Information Modelling*
- Publisher: Buildings Department, The Government of the Hong Kong Special Administrative Region
- Official source: <https://www.bd.gov.hk/doc/en/resources/codes-and-references/practice-notes-and-circular-letters/pnap/ADV/ADV034.pdf>
- Properties: four pages, unencrypted and machine-readable; suitable for preview and text-extraction testing
- Local SHA-256: `aa45cced0da8469d541e6a18d5c6c8f9e908776a9951acc5633742d6c9d110bc`

Additional, longer statutory-submission guidance:

- Local file: `hk-official/BIMSPS_2023_en.pdf`
- Title: *Guidelines for using Building Information Modelling in Statutory Plan Submissions (other than General Building Plan) 2023*
- Publisher: Buildings Department, The Government of the Hong Kong Special Administrative Region
- Official source: <https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BIMSPS_e.pdf>
- Treatment: local testing only; the PDF is Git-ignored and must not be redistributed with this repository. Users must verify the current edition at the official source.
- Local SHA-256: `121b7ea3889a86f8c1efcb00718dee7b22c9faeb0c25e3179d9ecd5d238924fe`
- Note: this official PDF restricts copying, so the platform keeps it previewable and truthfully requests an authorised OCR copy instead of inventing extracted rules.

## Concise open IFC model

- Local file: `ifc/IfcOpenHouse.ifc`
- Model: IfcOpenHouse, a small, single-storey house with footing, walls, openings, doors, windows and a roof
- Source: <https://github.com/cvillagrasa/IfcOpenHouse>
- Exact file: <https://github.com/cvillagrasa/IfcOpenHouse/blob/master/ifc/IfcOpenHouse.ifc>
- Licence: Apache License 2.0
- Intended test: clear geometry hierarchy, discovery colouring, internal reviewed-element picking and manual IFC upload
- Parsed fixture: IFC4, metres, one storey, one `IfcDoor`
- SHA-256: `6e3bb9e0074b1c098c0074b4f8ea6036a5198b93deeb036df7c99ea73f1f0932`

SHA-256 values and parsed entity counts are verified by the automated test suite.
