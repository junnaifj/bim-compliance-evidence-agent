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

export type RayPickCandidate = { globalId: string; expressId: number; distance: number; selectionPriority?: number };

export const normaliseGlobalId = (value: string) => value.trim();

export function buildPickStack(hits: RayPickCandidate[], reviewedGlobalIds: ReadonlySet<string>): RayPickCandidate[] {
  const reviewed = new Set([...reviewedGlobalIds].map(normaliseGlobalId));
  const nearestByGlobalId = new Map<string, RayPickCandidate>();
  for (const hit of hits) {
    const globalId = normaliseGlobalId(hit.globalId); if (!globalId || globalId.startsWith("express-")) continue;
    const candidate = { ...hit, globalId }; const previous = nearestByGlobalId.get(globalId);
    if (!previous || candidate.distance < previous.distance) nearestByGlobalId.set(globalId, candidate);
  }
  return [...nearestByGlobalId.values()].sort((a, b) => {
    const reviewedDelta = Number(reviewed.has(b.globalId)) - Number(reviewed.has(a.globalId));
    if (reviewedDelta) return reviewedDelta;
    const semanticDelta = (b.selectionPriority ?? 0) - (a.selectionPriority ?? 0);
    return semanticDelta || a.distance - b.distance;
  });
}

export function choosePickCandidate(hits: RayPickCandidate[], reviewedGlobalIds: ReadonlySet<string>): RayPickCandidate | undefined {
  return buildPickStack(hits, reviewedGlobalIds)[0];
}

export function cyclePickCandidate(stack: RayPickCandidate[], selectedGlobalId?: string): RayPickCandidate | undefined {
  if (!stack.length) return undefined; if (!selectedGlobalId) return stack[0];
  const current = stack.findIndex((item) => item.globalId === normaliseGlobalId(selectedGlobalId));
  return stack[(current + 1) % stack.length];
}

export function nextFindingByStatus(findings: Pick<Finding, "id" | "status">[], status: Finding["status"], currentId?: string): string | undefined {
  const queue = findings.filter((item) => item.status === status);
  if (!queue.length) return undefined;
  const current = queue.findIndex((item) => item.id === currentId);
  return queue[(current + 1) % queue.length].id;
}

export function shouldHandleReviewShortcut(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return true;
  return !target.closest("input, textarea, select, [contenteditable='true']");
}

export type VisualDescriptor = { colourRole: "original" | "status" | "grey"; opacityRole: "original" | "solid" | "dim" | "xray"; emphasised: boolean };

export function describeElementVisual(input: { globalId: string; reviewed: boolean; interaction: ViewerInteraction }): VisualDescriptor {
  const { globalId, reviewed, interaction } = input; const selected = interaction.selectedGlobalId === globalId; const hovered = !interaction.selectedGlobalId && interaction.hoveredGlobalId === globalId;
  if (interaction.selectedGlobalId) return selected ? { colourRole: reviewed ? "status" : "original", opacityRole: "solid", emphasised: true } : { colourRole: "grey", opacityRole: "dim", emphasised: false };
  if (interaction.pointerInside) return reviewed ? { colourRole: "status", opacityRole: "solid", emphasised: hovered } : { colourRole: "grey", opacityRole: "dim", emphasised: hovered };
  return { colourRole: reviewed ? "status" : "original", opacityRole: interaction.xray ? "xray" : "original", emphasised: false };
}
