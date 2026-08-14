# Candidate benchmark samples

These files are bundled to run the same independent evidence policy against the three submissions reviewed for this assessment. The displayed results are Evidence Agent outcomes, not the candidates’ own reported results.

| Bundled file | Candidate repository | Original path | Licence | Purpose |
| --- | --- | --- | --- | --- |
| `greatandyc-mixed-review.ifc` | [GreatAndyC/bim-review-agent-public](https://github.com/GreatAndyC/bim-review-agent-public) | `src/bim_review_agent/assets/samples/mixed_review.ifc` | MIT | Synthetic IFC4 with explicit `FireExit`, `ClearWidth` and fire-rating evidence |
| `waterywaterman-duplex.ifc` | [WateryWaterman/-HKU-AI-Agent-Technical-Test-SFS_HKU](https://github.com/WateryWaterman/-HKU-AI-Agent-Technical-Test-SFS_HKU) | `samples/Duplex_xeokit.ifc` | Apache-2.0 via xeokit-sdk | Realistic two-storey IFC2x3 with 14 doors |
| `mickey12go-sample-doors.ifc` | [Mickey12go/bim-compliance-checker](https://github.com/Mickey12go/bim-compliance-checker) | `examples/ifc/sample_doors.ifc` | MIT | Small hand-authored IFC4 door fixture |

The WateryWaterman repository attributes `Duplex_xeokit.ifc` to the [xeokit SDK](https://github.com/xeokit/xeokit-sdk), which is released under Apache License 2.0.

The benchmark does not rank candidates by raw FAIL or REVIEW counts. Synthetic fixtures contain deliberately planted issues, and realistic third-party IFC files may not carry the properties required by a particular review policy.
