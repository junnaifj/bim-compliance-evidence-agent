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
};

export type ViewerAction =
  | { type: "HOVER"; globalId?: string }
  | { type: "SELECT"; globalId?: string }
  | { type: "CLEAR" }
  | { type: "XRAY"; enabled: boolean };

export const initialViewerInteraction: ViewerInteraction = { xray: false };

export function reduceViewerInteraction(state: ViewerInteraction, action: ViewerAction): ViewerInteraction {
  if (action.type === "HOVER") return { ...state, hoveredGlobalId: state.selectedGlobalId ? undefined : action.globalId };
  if (action.type === "SELECT") return { ...state, selectedGlobalId: action.globalId, hoveredGlobalId: undefined };
  if (action.type === "CLEAR") return { xray: state.xray };
  return { ...state, xray: action.enabled };
}

export function filterFindingsForSelection(findings: Finding[], globalId?: string): Finding[] {
  return globalId ? findings.filter((finding) => finding.elementId === globalId) : findings;
}
