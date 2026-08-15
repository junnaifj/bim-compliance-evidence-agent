"use client";

import { useEffect, useRef, useState } from "react";
import type { Finding } from "../lib/compliance";
import { buildPickStack, cyclePickCandidate, describeElementVisual, normaliseGlobalId, type ViewerElement, type ViewerInteraction } from "../lib/viewer-interaction";
import { modelBaselineY } from "../lib/viewer-geometry";

type Props = {
  source: string | ArrayBuffer | null;
  sourceKey: string;
  findings: Finding[];
  selectedGlobalId?: string;
  onSelect(element: ViewerElement | null): void;
  locale: "en" | "zh";
};

type ViewerControls = {
  fit(): void;
  focus(globalId: string): void;
  toggleXray(): boolean;
  toggleSection(): boolean;
  setSelected(globalId?: string): void;
  dispose(): void;
  recolour(findings: Finding[]): void;
};

const statusColour = (status?: Finding["status"]) => status === "FAIL" ? 0xd7483f : status === "REVIEW" ? 0xe0a037 : status === "PASS" ? 0x278462 : status === "NOT_APPLICABLE" ? 0x77847e : undefined;

export default function IfcViewer({ source, sourceKey, findings, selectedGlobalId, onSelect, locale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const controlsRef = useRef<ViewerControls | null>(null); const onSelectRef = useRef(onSelect); const findingsRef = useRef(findings);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle"); const [message, setMessage] = useState(""); const [xray, setXray] = useState(false); const [section, setSection] = useState(false);
  const [hovered, setHovered] = useState<ViewerElement | null>(null); const [pointerInside, setPointerInside] = useState(false); const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(selectedGlobalId); const [tooltip, setTooltip] = useState({ x: 0, y: 0 });
  const [diagnostics, setDiagnostics] = useState({ reviewedMeshes: 0, colouredReviewedMeshes: 0, pickDepth: 0, modelMinY: 0, baselineY: 0 });
  onSelectRef.current = onSelect; findingsRef.current = findings;

  useEffect(() => {
    let cancelled = false; let animation = 0; let disposed = false;
    async function start() {
      if (!canvasRef.current || !source) return; setState("loading"); setMessage(locale === "zh" ? "正在解析 IFC 几何…" : "Parsing IFC geometry…"); setHovered(null); setInternalSelectedId(undefined);
      try {
        const THREE = await import("three"); const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js"); const WebIFC = await import("web-ifc");
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current; const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.localClippingEnabled = true;
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4f7f4); const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 10000); camera.position.set(18, 14, 18);
        const orbit = new OrbitControls(camera, canvas); orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.screenSpacePanning = true;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x5e7168, 2.4)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(12, 20, 10); scene.add(sun);
        const grid = new THREE.GridHelper(60, 60, 0xb7c5bd, 0xdfe6e1); scene.add(grid);
        const root = new THREE.Group(); scene.add(root); const byGlobalId = new Map<string, import("three").Mesh[]>(); const byExpressId = new Map<number, import("three").Mesh[]>(); const metadata = new Map<number, ViewerElement>();
        const api = new WebIFC.IfcAPI(); api.SetWasmPath("/wasm/"); await api.Init();
        const bytes = typeof source === "string" ? new Uint8Array(await (await fetch(source)).arrayBuffer()) : new Uint8Array(source.slice(0));
        const modelID = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: true }); const globalByExpress = new Map<number, string>();
        const productTypes: [number, string][] = [[WebIFC.IFCDOOR, "IfcDoor"], [WebIFC.IFCWALL, "IfcWall"], [WebIFC.IFCWALLSTANDARDCASE, "IfcWallStandardCase"], [WebIFC.IFCSLAB, "IfcSlab"], [WebIFC.IFCWINDOW, "IfcWindow"], [WebIFC.IFCCOLUMN, "IfcColumn"], [WebIFC.IFCBEAM, "IfcBeam"], [WebIFC.IFCROOF, "IfcRoof"], [WebIFC.IFCSTAIR, "IfcStair"], [WebIFC.IFCRAILING, "IfcRailing"], [WebIFC.IFCFURNISHINGELEMENT, "IfcFurnishingElement"], [WebIFC.IFCBUILDINGELEMENTPROXY, "IfcBuildingElementProxy"]]; const typeNames = new Map(productTypes);
        for (const [type, entityType] of productTypes) {
          const lineIds = api.GetLineIDsWithType(modelID, type);
          for (let i = 0; i < lineIds.size(); i += 1) { const expressId = lineIds.get(i); try { const line = api.GetLine(modelID, expressId, false); const globalId = normaliseGlobalId((line?.GlobalId?.value as string | undefined) ?? ""); if (globalId) { globalByExpress.set(expressId, globalId); metadata.set(expressId, { globalId, expressId, entityType, name: (line?.Name?.value as string | undefined) || `${entityType} #${expressId}` }); } } catch { /* malformed metadata is non-fatal */ } }
        }
        api.StreamAllMeshes(modelID, (flatMesh) => {
          if (!globalByExpress.has(flatMesh.expressID)) {
            try {
              const line = api.GetLine(modelID, flatMesh.expressID, false); const globalId = normaliseGlobalId((line?.GlobalId?.value as string | undefined) ?? "");
              if (globalId) { const entityType = typeNames.get(line.type as number) ?? api.GetNameFromTypeCode(line.type as number) ?? "IfcProduct"; globalByExpress.set(flatMesh.expressID, globalId); metadata.set(flatMesh.expressID, { globalId, expressId: flatMesh.expressID, entityType, name: (line?.Name?.value as string | undefined) || `${entityType} #${flatMesh.expressID}` }); }
            } catch { /* geometry remains visible even if metadata is malformed */ }
          }
          const meshes: import("three").Mesh[] = [];
          for (let index = 0; index < flatMesh.geometries.size(); index += 1) {
            const placed = flatMesh.geometries.get(index); const geometryData = api.GetGeometry(modelID, placed.geometryExpressID); const vertex = api.GetVertexArray(geometryData.GetVertexData(), geometryData.GetVertexDataSize()); const indices = api.GetIndexArray(geometryData.GetIndexData(), geometryData.GetIndexDataSize());
            const geometry = new THREE.BufferGeometry(); const positions = new Float32Array(vertex.length / 2); const normals = new Float32Array(vertex.length / 2);
            for (let sourceIndex = 0, targetIndex = 0; sourceIndex < vertex.length; sourceIndex += 6, targetIndex += 3) { positions[targetIndex] = vertex[sourceIndex]; positions[targetIndex + 1] = vertex[sourceIndex + 1]; positions[targetIndex + 2] = vertex[sourceIndex + 2]; normals[targetIndex] = vertex[sourceIndex + 3]; normals[targetIndex + 1] = vertex[sourceIndex + 4]; normals[targetIndex + 2] = vertex[sourceIndex + 5]; }
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3)); geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3)); geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(indices), 1));
            const colour = new THREE.Color(placed.color.x, placed.color.y, placed.color.z); const originalOpacity = Math.max(0.2, placed.color.w); const material = new THREE.MeshStandardMaterial({ color: colour, transparent: originalOpacity < 0.99, opacity: originalOpacity, side: THREE.DoubleSide, roughness: 0.78, metalness: 0.03 });
            const mesh = new THREE.Mesh(geometry, material); mesh.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation)); mesh.userData.expressId = flatMesh.expressID; mesh.userData.globalId = globalByExpress.get(flatMesh.expressID) ?? `express-${flatMesh.expressID}`; mesh.userData.originalColour = colour.clone(); mesh.userData.originalOpacity = originalOpacity; root.add(mesh); meshes.push(mesh);
          }
          byExpressId.set(flatMesh.expressID, [...(byExpressId.get(flatMesh.expressID) ?? []), ...meshes]); const globalId = globalByExpress.get(flatMesh.expressID); if (globalId) byGlobalId.set(globalId, [...(byGlobalId.get(globalId) ?? []), ...meshes]);
        });
        api.CloseModel(modelID);
        // Preserve placed IFC XYZ geometry and the established Three.js Y-up
        // viewing convention. Move only the grid to the model's visual baseline.
        root.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(root); const displayBaselineY = modelBaselineY(bounds.min.y); grid.position.y = displayBaselineY - Math.max(bounds.getSize(new THREE.Vector3()).y * 0.0005, 0.001);
        const centre = bounds.getCenter(new THREE.Vector3()); const size = bounds.getSize(new THREE.Vector3()); const radius = Math.max(size.x, size.y, size.z, 1);
        const fit = (box = bounds) => { const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3()); const r = Math.max(s.x, s.y, s.z, 1); camera.position.set(c.x + r * 1.5, c.y + r, c.z + r * 1.5); camera.near = Math.max(r / 1000, 0.01); camera.far = r * 100; camera.updateProjectionMatrix(); orbit.target.copy(c); orbit.update(); };
        fit(); const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const visual: ViewerInteraction = { xray: false, pointerInside: false }; let currentFindings = findingsRef.current; let pointerFrame = 0;
        const priority: Record<string, number> = { FAIL: 4, REVIEW: 3, PASS: 2, NOT_APPLICABLE: 1 };
        const bestFinding = () => { const best = new Map<string, Finding>(); currentFindings.forEach((finding) => { const globalId = normaliseGlobalId(finding.elementId); if (!best.has(globalId) || priority[finding.status] > priority[best.get(globalId)!.status]) best.set(globalId, finding); }); return best; };
        const applyVisual = () => {
          const statuses = bestFinding(); const effectiveInteraction = { ...visual, pointerInside: visual.pointerInside && statuses.size > 0 }; let reviewedMeshes = 0; let colouredReviewedMeshes = 0;
          for (const mesh of root.children as import("three").Mesh[]) {
            const material = mesh.material as import("three").MeshStandardMaterial; const globalId = normaliseGlobalId(mesh.userData.globalId as string); const finding = statuses.get(globalId); const descriptor = describeElementVisual({ globalId, reviewed: Boolean(finding), interaction: effectiveInteraction }); const findingColour = statusColour(finding?.status); if (finding) reviewedMeshes += 1;
            material.color.copy(mesh.userData.originalColour); if (descriptor.colourRole === "status" && findingColour !== undefined) material.color.setHex(findingColour); if (descriptor.colourRole === "grey") material.color.setHex(0x9da8a2); material.emissive.setHex(0x000000); material.emissiveIntensity = 1;
            material.opacity = descriptor.opacityRole === "solid" ? 1 : descriptor.opacityRole === "dim" ? 0.12 : descriptor.opacityRole === "xray" ? 0.18 : mesh.userData.originalOpacity;
            if (descriptor.emphasised) { material.emissive.setHex(visual.selectedGlobalId ? 0x14382b : 0x1d5d45); material.emissiveIntensity = visual.selectedGlobalId ? 0.65 : 0.45; }
            material.transparent = material.opacity < 0.99; material.depthWrite = material.opacity >= 0.5; material.needsUpdate = true; if (finding && descriptor.colourRole === "status" && descriptor.opacityRole === "solid") colouredReviewedMeshes += 1;
          }
          setDiagnostics((current) => current.reviewedMeshes === reviewedMeshes && current.colouredReviewedMeshes === colouredReviewedMeshes && current.baselineY === displayBaselineY ? current : { ...current, reviewedMeshes, colouredReviewedMeshes, modelMinY: bounds.min.y, baselineY: displayBaselineY });
        };
        const semanticPriority = (entityType: string) => /door/i.test(entityType) ? 100 : /window/i.test(entityType) ? 90 : /stair|railing/i.test(entityType) ? 80 : /beam|column|member|plate/i.test(entityType) ? 60 : /wall|roof/i.test(entityType) ? 30 : /slab|covering/i.test(entityType) ? 20 : 10;
        const hitStackAt = (event: MouseEvent) => { const rect = canvas.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects(root.children, false).map((hit) => { const expressId = hit.object.userData.expressId as number; return { globalId: hit.object.userData.globalId as string, expressId, distance: hit.distance, selectionPriority: semanticPriority(metadata.get(expressId)?.entityType ?? "") }; }); const reviewed = new Set(currentFindings.map((finding) => normaliseGlobalId(finding.elementId))); return buildPickStack(hits, reviewed); };
        const elementFor = (candidate?: { expressId: number }) => candidate ? metadata.get(candidate.expressId) ?? null : null;
        const enter = () => { visual.pointerInside = true; setPointerInside(true); applyVisual(); };
        const move = (event: MouseEvent) => { setTooltip({ x: event.offsetX + 14, y: event.offsetY + 14 }); visual.pointerInside = true; setPointerInside(true); if (pointerFrame || visual.selectedGlobalId) return; pointerFrame = requestAnimationFrame(() => { pointerFrame = 0; const stack = hitStackAt(event); const item = elementFor(stack[0]); setDiagnostics((current) => current.pickDepth === stack.length ? current : { ...current, pickDepth: stack.length }); if (item?.globalId === visual.hoveredGlobalId) return; visual.hoveredGlobalId = item?.globalId; setHovered(item); applyVisual(); }); };
        const leave = () => { visual.pointerInside = false; setPointerInside(false); visual.hoveredGlobalId = undefined; setHovered(null); applyVisual(); };
        let lastSelectionPoint: { x: number; y: number } | undefined;
        const select = (event: MouseEvent) => { const stack = hitStackAt(event); const repeatedPoint = lastSelectionPoint && Math.hypot(event.clientX - lastSelectionPoint.x, event.clientY - lastSelectionPoint.y) <= 6; const candidate = cyclePickCandidate(stack, repeatedPoint ? visual.selectedGlobalId : undefined); const item = elementFor(candidate); lastSelectionPoint = item ? { x: event.clientX, y: event.clientY } : undefined; visual.selectedGlobalId = item?.globalId; visual.hoveredGlobalId = undefined; setHovered(null); setInternalSelectedId(item?.globalId); setDiagnostics((current) => ({ ...current, pickDepth: stack.length })); applyVisual(); onSelectRef.current(item); };
        const keydown = (event: KeyboardEvent) => { if (event.key !== "Escape") return; visual.selectedGlobalId = undefined; visual.hoveredGlobalId = undefined; setInternalSelectedId(undefined); setHovered(null); applyVisual(); onSelectRef.current(null); };
        canvas.addEventListener("mouseenter", enter); canvas.addEventListener("mousemove", move); canvas.addEventListener("mouseleave", leave); canvas.addEventListener("click", select); window.addEventListener("keydown", keydown);
        let sectionEnabled = false; const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), centre.y + size.y * 0.25);
        controlsRef.current = {
          fit: () => fit(),
          focus: (globalId) => { const objects = byGlobalId.get(globalId); if (!objects?.length) return; const box = new THREE.Box3(); objects.forEach((object) => box.expandByObject(object)); fit(box.expandByScalar(radius * 0.02)); },
          toggleXray: () => { visual.xray = !visual.xray; applyVisual(); return visual.xray; },
          toggleSection: () => { sectionEnabled = !sectionEnabled; for (const mesh of root.children as import("three").Mesh[]) (mesh.material as import("three").MeshStandardMaterial).clippingPlanes = sectionEnabled ? [plane] : []; return sectionEnabled; },
          setSelected: (globalId) => { visual.selectedGlobalId = globalId; visual.hoveredGlobalId = undefined; setInternalSelectedId(globalId); setHovered(null); applyVisual(); },
          recolour: (next) => { currentFindings = next; applyVisual(); },
          dispose: () => { disposed = true; cancelAnimationFrame(animation); cancelAnimationFrame(pointerFrame); canvas.removeEventListener("mouseenter", enter); canvas.removeEventListener("mousemove", move); canvas.removeEventListener("mouseleave", leave); canvas.removeEventListener("click", select); window.removeEventListener("keydown", keydown); orbit.dispose(); root.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as import("three").Material).dispose(); } }); renderer.dispose(); },
        };
        applyVisual(); setState("ready"); setMessage(locale === "zh" ? `${root.children.length} 个几何片段 · 悬停预览，单击选中` : `${root.children.length} geometry fragments · hover to preview, click to select`);
        const resize = () => { const width = canvas.clientWidth; const height = canvas.clientHeight; if (canvas.width !== width * renderer.getPixelRatio() || canvas.height !== height * renderer.getPixelRatio()) { renderer.setSize(width, height, false); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); } };
        const loop = () => { if (disposed) return; resize(); orbit.update(); renderer.render(scene, camera); animation = requestAnimationFrame(loop); }; loop();
      } catch (error) { if (!cancelled) { setState("error"); setMessage(error instanceof Error ? error.message : "IFC geometry could not be loaded."); } }
    }
    start(); return () => { cancelled = true; controlsRef.current?.dispose(); controlsRef.current = null; };
  }, [source, sourceKey, locale]);

  useEffect(() => { controlsRef.current?.recolour(findings); }, [findings]);
  useEffect(() => { controlsRef.current?.setSelected(selectedGlobalId); }, [selectedGlobalId]);

  const hoverFinding = hovered ? findings.find((finding) => finding.elementId === hovered.globalId) : undefined;
  return <div className="ifc-viewer">
    <canvas ref={canvasRef} tabIndex={0} aria-label={locale === "zh" ? "可交互 IFC 三维模型" : "Interactive IFC three-dimensional model"} />
    <div className={`viewer-state viewer-${state}`}><i />{message || (locale === "zh" ? "请选择模型" : "Select a model")}</div>
    <div className="viewer-diagnostics" data-testid="viewer-diagnostics" data-mode={internalSelectedId ? "selected" : hovered ? "hovered" : pointerInside ? "discovery" : "normal"} data-selected={internalSelectedId ?? ""} data-hovered={hovered?.globalId ?? ""} data-pointer-inside={pointerInside ? "true" : "false"} data-reviewed-meshes={diagnostics.reviewedMeshes} data-coloured-reviewed-meshes={diagnostics.colouredReviewedMeshes} data-pick-depth={diagnostics.pickDepth} data-model-min-y={diagnostics.modelMinY.toFixed(5)} data-baseline-y={diagnostics.baselineY.toFixed(5)} aria-hidden="true" />
    {hovered && !internalSelectedId && <div className="element-tooltip" style={{ left: tooltip.x, top: tooltip.y }}><strong>{hovered.name}</strong><span>{hovered.entityType}</span><code>{hovered.globalId}</code><small>{hoverFinding ? hoverFinding.status.replace("_", " ") : (locale === "zh" ? "无适用的启用规则" : "No applicable active rule")}</small></div>}
    <div className="viewer-tools" role="toolbar" aria-label={locale === "zh" ? "模型查看工具" : "Model viewing tools"}>
      <button onClick={() => controlsRef.current?.fit()} title={locale === "zh" ? "适应视图" : "Fit model"}>⌂</button>
      {internalSelectedId && <button onClick={() => controlsRef.current?.focus(internalSelectedId)} title={locale === "zh" ? "聚焦选中构件" : "Focus selected element"}>◎</button>}
      <button className={xray ? "on" : ""} onClick={() => setXray(controlsRef.current?.toggleXray() ?? false)} title={locale === "zh" ? "半透明" : "X-ray"}>◐</button>
      <button className={section ? "on" : ""} onClick={() => setSection(controlsRef.current?.toggleSection() ?? false)} title={locale === "zh" ? "剖切" : "Section plane"}>◩</button>
    </div>
  </div>;
}
