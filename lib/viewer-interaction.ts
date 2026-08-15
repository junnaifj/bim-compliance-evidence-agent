import type { Finding } from "./compliance";

export type ViewerElement = {
  globalId: string;
  expressId: number;
  entityType: string;
  name: string;
};

export type ViewerInteraction = {
  hoveredGlobalId?: string;
  selectedGlobalId?: string;
  xray: boolean;
  pointerInside: boolean;
};

export type ViewerAction =
  | { type: "HOVER"; globalId?: string }
  | { type: "SELECT"; globalId?: string }
  | { type: "CLEAR" }
  | { type: "ENTER" }
  | { type: "LEAVE" }
  | { type: "XRAY"; enabled: boolean };

export const initialViewerInteraction: ViewerInteraction = { xray: false, pointerInside: false };

export function reduceViewerInteraction(state: ViewerInteraction, action: ViewerAction): ViewerInteraction {
  if (action.type === "HOVER") return { ...state, pointerInside: true, hoveredGlobalId: state.selectedGlobalId ? undefined : action.globalId };
  if (action.type === "SELECT") return { ...state, selectedGlobalId: action.globalId, hoveredGlobalId: undefined };
  if (action.type === "CLEAR") return { xray: state.xray, pointerInside: state.pointerInside };
  if (action.type === "ENTER") return { ...state, pointerInside: true };
  if (action.type === "LEAVE") return { ...state, pointerInside: false, hoveredGlobalId: undefined };
  return { ...state, xray: action.enabled };
}

export function filterFindingsForSelection(findings: Finding[], globalId?: string): Finding[] {
  return globalId ? findings.filter((finding) => finding.elementId === globalId) : findings;
}

export type RayPickCandidate = { globalId: string; expressId: number; distance: number };

export function choosePickCandidate(hits: RayPickCandidate[], reviewedGlobalIds: ReadonlySet<string>): RayPickCandidate | undefined {
  const ordered = [...hits].sort((a, b) => a.distance - b.distance);
  return ordered.find((hit) => reviewedGlobalIds.has(hit.globalId)) ?? ordered[0];
}

export type VisualDescriptor = { colourRole: "original" | "status" | "grey"; opacityRole: "original" | "dim" | "xray"; emphasised: boolean };

export function describeElementVisual(input: { globalId: string; reviewed: boolean; interaction: ViewerInteraction }): VisualDescriptor {
  const { globalId, reviewed, interaction } = input; const selected = interaction.selectedGlobalId === globalId; const hovered = !interaction.selectedGlobalId && interaction.hoveredGlobalId === globalId;
  if (interaction.selectedGlobalId) return selected ? { colourRole: reviewed ? "status" : "original", opacityRole: "original", emphasised: true } : { colourRole: "grey", opacityRole: "dim", emphasised: false };
  if (interaction.pointerInside) return reviewed ? { colourRole: "status", opacityRole: "original", emphasised: hovered } : { colourRole: "grey", opacityRole: "dim", emphasised: hovered };
  return { colourRole: reviewed ? "status" : "original", opacityRole: interaction.xray ? "xray" : "original", emphasised: false };
}
