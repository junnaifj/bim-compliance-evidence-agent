# Manual upload fixtures

These files are deliberately separate from the built-in assessment samples. They are intended for manual upload testing of model intake and rule-source intelligence.

## Hong Kong official BIM guidance

- Local file: `hk-official/BIMSPS_2023_en.pdf`
- Title: *Guidelines for using Building Information Modelling in Statutory Plan Submissions (other than General Building Plan) 2023*
- Publisher: Buildings Department, The Government of the Hong Kong Special Administrative Region
- Official source: <https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BIMSPS_e.pdf>
- Treatment: local testing only; the PDF is Git-ignored and must not be redistributed with this repository. Users must verify the current edition at the official source.
- Local SHA-256: `121b7ea3889a86f8c1efcb00718dee7b22c9faeb0c25e3179d9ecd5d238924fe`

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
