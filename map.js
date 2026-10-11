import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';

const COLORS = ['#a7ffd1', '#60e8b0', '#d2ffe2', '#83d6c6', '#b7ead0'];
const FOREST = '#061916';
const TAU = Math.PI * 2;

function colorFor(group) {
  let hash = 0;
  for (const character of String(group || 'core')) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function disposeObjects(group) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  group.traverse((object) => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        if (material.map?.userData.atlasOwned) textures.add(material.map);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  group.clear();
}

function hexagon(size) {
  const shape = new THREE.Shape();
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * TAU + Math.PI / 6;
    const x = Math.cos(angle) * size;
    const y = Math.sin(angle) * size;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function architecturalPlate(size, depth) {
  const geometry = new THREE.ExtrudeGeometry(hexagon(size), {
    depth, bevelEnabled: true, bevelSize: Math.min(size * 0.075, 0.065),
    bevelThickness: 0.045, bevelSegments: 2, steps: 1, curveSegments: 1,
  });
  geometry.computeVertexNormals();
  return geometry;
}

function labelTexture(text) {
  const canvas = document.createElement('canvas');
  const measuring = canvas.getContext('2d');
  if (!measuring) return null;
  measuring.font = '600 28px Arial, sans-serif';
  const cssWidth = Math.ceil(measuring.measureText(text).width / 2) + 16;
  canvas.width = cssWidth * 2;
  canvas.height = 56;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(6,25,22,.82)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#d4fce5';
  context.font = '600 28px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, 28);
  context.fillStyle = 'rgba(147,247,186,.28)';
  context.fillRect(0, canvas.height - 2, canvas.width, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.atlasOwned = true;
  return { texture, width: cssWidth, height: 28 };
}

function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(179,255,213,.5)');
  gradient.addColorStop(0.2, 'rgba(116,239,171,.16)');
  gradient.addColorStop(0.55, 'rgba(61,184,127,.045)');
  gradient.addColorStop(1, 'rgba(61,184,127,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A source-driven architecture map with an equivalent keyboard-accessible list. */
export function createAtlas(container, { onSelect = () => {}, onHover = () => {} } = {}) {
  let destroyed = false;
  let fallback = false;
  let selectedId = null;
  let hoveredId = null;
  let flowStep = -1;
  let graph = { nodes: [], edges: [] };
  let nodeViews = [];
  let edgeViews = [];
  let raycastTargets = [];
  let frame = null;
  let lastFrame = 0;
  let elapsed = 0;
  let width = 1;
  let height = 1;
  let baseDistance = 20;
  let zoomFactor = 1;
  let radius = 8;
  let fitExtent = new THREE.Vector2(8, 5);
  let composer;
  let bloom;
  let focusId = null;
  let layoutMoving = false;
  let startup = true;
  let cameraDistance = 25;
  let desiredDistance = 20;
  const cameraAim = new THREE.Vector3();
  const desiredAim = new THREE.Vector3();
  const parallax = new THREE.Vector2();
  const desiredParallax = new THREE.Vector2();
  const cameraDirection = new THREE.Vector3(0.52, 0.75, 1).normalize();
  const cameraRight = new THREE.Vector3(cameraDirection.z, 0, -cameraDirection.x).normalize();
  const cameraUp = new THREE.Vector3().crossVectors(cameraDirection, cameraRight).normalize();
  let pointer = null;
  let suppressClickUntil = 0;
  let renderer;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let requestedMotion = !reducedMotion.matches;
  const oldPosition = container.style.position;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const root = document.createElement('div');
  root.className = 'atlas-scene';
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden' });
  const labels = document.createElement('div');
  labels.className = 'atlas-labels';
  Object.assign(labels.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  root.append(labels);
  container.append(root);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOREST);
  scene.fog = new THREE.FogExp2(FOREST, 0.018);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 500);
  const rotation = new THREE.Group();
  rotation.rotation.set(-0.02, -0.18, 0);
  const content = new THREE.Group();
  const atmosphere = new THREE.Group();
  rotation.add(atmosphere, content);
  scene.add(rotation);
  scene.add(new THREE.HemisphereLight('#c0ffe1', '#062820', 1.8));
  const keyLight = new THREE.DirectionalLight('#dcffeb', 3.2);
  keyLight.position.set(-6, 9, 16);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.0008;
  keyLight.shadow.normalBias = 0.04;
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight('#49d399', 2.3);
  rimLight.position.set(8, -4, 9);
  scene.add(rimLight);
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const halo = haloTexture();

  const notifyHover = (id) => {
    if (hoveredId === id) return;
    hoveredId = id;
    updateAppearance();
    onHover(id);
    requestRender();
  };

  function stopFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrame = 0;
  }

  function animating() {
    return !destroyed && !fallback && requestedMotion && !reducedMotion.matches && !document.hidden;
  }

  function requestRender() {
    if (destroyed || fallback || document.hidden || frame !== null) return;
    frame = requestAnimationFrame(renderFrame);
  }

  function updateCamera(snap = false) {
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    baseDistance = Math.max(fitExtent.y, fitExtent.x / Math.max(camera.aspect, 0.35)) / tangent * 1.11;
    desiredDistance = baseDistance * zoomFactor * (focusId ? 0.82 : 1);
    desiredAim.copy(cameraRight).multiplyScalar(-radius * 0.09).addScaledVector(cameraUp, radius * 0.035);
    const focused = nodeViews.find((view) => view.node.id === focusId);
    if (focused?.group) {
      rotation.updateMatrixWorld(true);
      focused.group.getWorldPosition(worldPosition);
      desiredAim.lerp(worldPosition, 0.58);
    }
    if (snap || !animating()) {
      cameraDistance = desiredDistance;
      cameraAim.copy(desiredAim);
      parallax.copy(desiredParallax);
    }
    camera.position.copy(cameraAim).addScaledVector(cameraDirection, cameraDistance)
      .addScaledVector(cameraRight, parallax.x * 0.4).addScaledVector(cameraUp, parallax.y * 0.24);
    camera.lookAt(cameraAim);
    camera.far = Math.max(500, baseDistance * 6);
    camera.updateProjectionMatrix();
  }

  function makeLabel(node, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'atlas-label';
    button.dataset.nodeId = node.id;
    button.textContent = node.shortLabel || node.label || node.id;
    button.setAttribute('aria-label', [node.label || node.id, node.subtitle].filter(Boolean).join('. '));
    button.setAttribute('aria-pressed', 'false');
    Object.assign(button.style, {
      position: 'absolute', pointerEvents: 'auto', padding: '5px 8px',
      border: '1px solid transparent', borderRadius: '2px',
      background: 'transparent', color: 'transparent',
      fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer',
      transform: 'translate(-50%, -50%)', touchAction: 'none',
      transition: 'background 160ms, border-color 160ms, color 160ms',
    });
    button.style.fontFamily = 'inherit';
    button.style.fontSize = '14px';
    button.style.lineHeight = '1.2';
    button.addEventListener('click', (event) => {
      if (event.detail > 0 && performance.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }
      onSelect(node.id);
    });
    button.addEventListener('pointerenter', () => { if (!pointer) notifyHover(node.id); });
    button.addEventListener('pointerleave', () => { if (!pointer) notifyHover(null); });
    button.addEventListener('focus', () => {
      button.style.outline = '2px solid #b6ffd0';
      button.style.outlineOffset = '3px';
      notifyHover(node.id);
    });
    button.addEventListener('blur', () => {
      button.style.outline = 'none';
      notifyHover(null);
    });
    button.dataset.order = String(index);
    labels.append(button);
    return button;
  }

  function renderFallback() {
    labels.replaceChildren();
    Object.assign(labels.style, {
      position: 'absolute', inset: '0', pointerEvents: 'auto', overflow: 'auto',
      padding: '24px', display: 'grid', alignContent: 'start', gap: '9px',
    });
    const note = document.createElement('p');
    note.className = 'atlas-fallback-note';
    note.textContent = 'Explore the architecture by choosing a component.';
    note.style.color = '#b8dcc9';
    labels.append(note);
    nodeViews = graph.nodes.map((node, index) => {
      const button = makeLabel(node, index);
      Object.assign(button.style, {
        position: 'relative', transform: 'none', whiteSpace: 'normal', textAlign: 'left',
        padding: '14px 16px', width: '100%', fontSize: '14px',
        color: '#d4fce5', background: '#10372a', borderColor: '#28694d',
      });
      if (node.subtitle) {
        const subtitle = document.createElement('span');
        subtitle.textContent = node.subtitle;
        Object.assign(subtitle.style, { display: 'block', color: '#8dac9b', marginTop: '5px', fontSize: '12px' });
        button.append(subtitle);
      }
      return { node, button };
    });
    updateAppearance();
  }

  function enterFallback() {
    if (destroyed) return;
    fallback = true;
    stopFrame();
    renderer?.domElement.remove();
    root.classList.add('atlas-fallback');
    root.style.background = FOREST;
    renderFallback();
  }

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(FOREST, 1);
    const canvas = renderer.domElement;
    canvas.className = 'atlas-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
    canvas.addEventListener('webglcontextlost', contextLost);
    root.prepend(canvas);
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.68, 0.65, 1.0);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } catch {
      disposeComposer();
    }
  } catch {
    enterFallback();
  }

  function contextLost(event) {
    event.preventDefault();
    enterFallback();
  }

  function makeAtmosphere() {
    disposeObjects(atmosphere);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(radius * 6, radius * 6),
      new THREE.MeshStandardMaterial({ color: '#092a23', roughness: 0.88, metalness: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.7;
    floor.receiveShadow = true;
    atmosphere.add(floor);
    const grid = [];
    const spacing = Math.max(radius / 11, 0.65);
    const span = spacing * 20;
    for (let index = -20; index <= 20; index += 1) {
      grid.push(-span, -1.68, index * spacing, span, -1.68, index * spacing);
      grid.push(index * spacing, -1.68, -span, index * spacing, -1.68, span);
    }
    atmosphere.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute(grid, 3)), new THREE.LineBasicMaterial({
      color: '#418c69', transparent: true, opacity: 0.17,
    })));
    const trace = [];
    for (let index = -2; index <= 2; index += 1) {
      const x = index * radius * 0.65;
      trace.push(x, -1.64, -radius * 1.8, x, -1.64, -radius * 0.65,
        x, -1.64, -radius * 0.65, x + radius * 0.15, -1.64, -radius * 0.5,
        x + radius * 0.15, -1.64, -radius * 0.5, x + radius * 0.15, -1.64, radius * 1.8);
    }
    atmosphere.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute(trace, 3)), new THREE.LineBasicMaterial({
      color: '#62d797', transparent: true, opacity: 0.23,
    })));
    if (halo) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#5bbc84',
        transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(radius * 3.4, radius * 3.4, 1);
      glow.position.set(0, -1, 0);
      atmosphere.add(glow);
    }
    keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -radius * 1.8;
    keyLight.shadow.camera.right = keyLight.shadow.camera.top = radius * 1.8;
    keyLight.shadow.camera.far = radius * 7;
    keyLight.shadow.camera.updateProjectionMatrix();
  }

  function makeIsland(node, index, position) {
    const group = new THREE.Group();
    group.position.copy(position);
    const body = new THREE.Group();
    body.rotation.x = -Math.PI / 2;
    group.add(body);
    const scale = THREE.MathUtils.clamp(Number(node.size) || 1, 0.45, 3.6);
    const footprint = 0.56 * scale;
    const color = colorFor(node.group);
    const bright = new THREE.Color(color).multiplyScalar(2.5);
    const central = scale >= 2;
    const depth = 0.16 + scale * 0.06;
    const geometry = node.shape === 'tile'
      ? new THREE.BoxGeometry(footprint * 1.55, footprint * 1.55, depth)
      : architecturalPlate(footprint, depth);
    if (node.shape === 'tile') geometry.translate(0, 0, depth / 2);
    const base = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: '#174b36', emissive: '#0e3c28', emissiveIntensity: 0.45, metalness: 0.52, roughness: 0.32,
    }));
    base.castShadow = base.receiveShadow = true;
    base.userData.nodeId = node.id;
    body.add(base);
    raycastTargets.push(base);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30),
      new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.52 }));
    body.add(outline);
    const lower = new THREE.Mesh(geometry.clone(), new THREE.MeshStandardMaterial({
      color: '#0a3025', metalness: 0.6, roughness: 0.35,
    }));
    lower.position.z = -0.2;
    lower.scale.set(1.1, 1.1, 0.7);
    lower.castShadow = true;
    body.add(lower);
    const innerGeometry = architecturalPlate(footprint * 0.54, central ? 0.46 : 0.2);
    const core = new THREE.Mesh(innerGeometry, new THREE.MeshStandardMaterial({
      color: '#639a76', emissive: color, emissiveIntensity: central ? 1.65 : 1.08,
      roughness: 0.24, metalness: 0.5,
    }));
    core.position.z = depth + 0.025;
    core.castShadow = true;
    core.userData.nodeId = node.id;
    body.add(core);
    raycastTargets.push(core);
    const coreOutline = new THREE.LineSegments(new THREE.EdgesGeometry(innerGeometry, 30),
      new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.76 }));
    coreOutline.position.copy(core.position);
    body.add(coreOutline);
    const topHeight = depth + (central ? 0.48 : 0.23);
    const rim = new THREE.Group();
    const rimPoints = [];
    for (let step = 0; step <= 72; step += 1) {
      const angle = step / 72 * TAU;
      rimPoints.push(new THREE.Vector3(Math.cos(angle) * footprint * 0.82,
        Math.sin(angle) * footprint * 0.82, depth + 0.08));
    }
    rim.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rimPoints),
      new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: central ? 0.52 : 0.27 })));
    const ports = new THREE.InstancedMesh(new THREE.BoxGeometry(footprint * 0.25, 0.025, 0.028),
      new THREE.MeshBasicMaterial({ color: bright }), 6);
    const portTransform = new THREE.Object3D();
    for (let port = 0; port < 6; port += 1) {
      const angle = port / 6 * TAU;
      portTransform.position.set(Math.cos(angle) * footprint * 0.72, Math.sin(angle) * footprint * 0.72, depth + 0.02);
      portTransform.rotation.z = angle;
      portTransform.updateMatrix();
      ports.setMatrixAt(port, portTransform.matrix);
    }
    rim.add(ports);
    body.add(rim);
    if (node.shape !== 'tile') {
      const towerCount = central ? 8 : 4;
      const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: '#245c40', emissive: color, emissiveIntensity: 0.2,
          roughness: 0.35, metalness: 0.55 }), towerCount);
      const dummy = new THREE.Object3D();
      for (let tower = 0; tower < towerCount; tower += 1) {
        const angle = tower / towerCount * TAU + index * 0.13;
        const towerHeight = 0.13 + ((tower * 3 + index) % 5) * 0.065 * scale;
        dummy.position.set(Math.cos(angle) * footprint * 1.2, Math.sin(angle) * footprint * 1.2, towerHeight / 2 - 0.07);
        dummy.scale.set(0.09 * Math.sqrt(scale), 0.09 * Math.sqrt(scale), towerHeight);
        dummy.rotation.z = angle;
        dummy.updateMatrix();
        towers.setMatrixAt(tower, dummy.matrix);
      }
      towers.castShadow = true;
      body.add(towers);
    }
    let glow;
    if (halo) {
      glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color, transparent: true,
        opacity: central ? 0.55 : 0.34, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.y = topHeight * 0.5;
      glow.scale.set(footprint * 5.2, footprint * 5.2, 1);
      group.add(glow);
    }
    const labelHeight = topHeight + 0.58;
    const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, topHeight, 0), new THREE.Vector3(0, labelHeight - 0.1, 0),
    ]), new THREE.LineBasicMaterial({ color: '#8ed9b0', transparent: true, opacity: 0.6 }));
    group.add(stem);
    const label = labelTexture(node.shortLabel || node.label || node.id);
    let labelSprite;
    if (label) {
      labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: label.texture, transparent: true,
        depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false }));
      labelSprite.position.set(0, labelHeight, 0);
      labelSprite.renderOrder = 20;
      group.add(labelSprite);
    }
    content.add(group);
    return { node, group, body, core, outline, coreOutline, rim, glow, labelSprite, label,
      footprint, topHeight, labelHeight, targetPosition: position.clone(), phase: index * 0.73,
      button: makeLabel(node, index) };
  }

  function refreshEdge(view) {
    const start = view.from.group.position.clone();
    const end = view.to.group.position.clone();
    const direction = end.clone().sub(start);
    const horizontal = direction.clone().setY(0).normalize();
    start.addScaledVector(horizontal, view.from.footprint * 0.83);
    end.addScaledVector(horizontal, -view.to.footprint * 0.83);
    start.y += view.from.topHeight * 0.65;
    end.y += view.to.topHeight * 0.65;
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const normal = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    midpoint.addScaledVector(normal, Math.min(direction.length() * 0.13, 1.6) * (view.index % 2 ? -1 : 1));
    midpoint.y += Math.min(direction.length() * 0.085, 1.7) + 0.28;
    view.curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
    view.line.geometry.dispose();
    view.line.geometry = new THREE.TubeGeometry(view.curve, 26, 0.015, 4, false);
    view.haze.geometry.dispose();
    view.haze.geometry = new THREE.TubeGeometry(view.curve, 26, 0.046, 4, false);
    view.arrow.position.copy(view.curve.getPoint(0.81));
    view.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), view.curve.getTangent(0.81).normalize());
  }

  function setGraph(nextGraph = {}) {
    if (destroyed) return;
    const previous = new Map(nodeViews.filter((view) => view.group).map((view) => [view.node.id, view.group.position.clone()]));
    const previousPositions = [...previous.values()];
    graph = {
      nodes: Array.isArray(nextGraph.nodes) ? nextGraph.nodes.filter((node) => node && typeof node.id === 'string') : [],
      edges: Array.isArray(nextGraph.edges) ? nextGraph.edges : [],
    };
    flowStep = -1;
    focusId = null;
    hoveredId = null;
    if (fallback) { renderFallback(); return; }
    disposeObjects(content);
    labels.replaceChildren();
    nodeViews = [];
    edgeViews = [];
    raycastTargets = [];
    const bounds = new THREE.Box3();
    const nodeById = new Map();
    graph.nodes.forEach((node) => {
      const coordinates = Array.isArray(node.position) && node.position.length === 3 && node.position.every(Number.isFinite)
        ? node.position : [0, 0, 0];
      bounds.expandByPoint(new THREE.Vector3(...coordinates));
    });
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    center.y = 0;
    const size = bounds.isEmpty() ? new THREE.Vector3(10, 4, 10) : bounds.getSize(new THREE.Vector3());
    radius = Math.max(Math.hypot(size.x, size.z) * 0.53, 5);
    fitExtent.set(size.x * 0.56 + size.z * 0.23 + 1.4, size.z * 0.4 + size.y * 0.55 + 2.2);
    layoutMoving = animating() && previousPositions.length > 0;
    graph.nodes.forEach((node, index) => {
      const coordinates = Array.isArray(node.position) && node.position.length === 3 && node.position.every(Number.isFinite)
        ? node.position : [0, 0, 0];
      const target = new THREE.Vector3(...coordinates).sub(center);
      const view = makeIsland(node, index, target);
      if (layoutMoving) view.group.position.copy(previous.get(node.id) || previousPositions[index % previousPositions.length]);
      nodeById.set(node.id, view);
      nodeViews.push(view);
    });
    graph.edges.forEach((edge, index) => {
      const from = nodeById.get(edge?.from);
      const to = nodeById.get(edge?.to);
      if (!from || !to || from === to) return;
      const luminous = new THREE.Color('#8cf0b8').multiplyScalar(1.8);
      const line = new THREE.Mesh(new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({ color: luminous, transparent: true, opacity: 0.57 }));
      const haze = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
        color: '#72ecad', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const packet = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.13, 3, 5),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#c7ffe2').multiplyScalar(3.2) }));
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.17, 4),
        new THREE.MeshBasicMaterial({ color: luminous, transparent: true, opacity: 0.8 }));
      content.add(line, haze, packet, arrow);
      const view = { edge, from, to, line, haze, packet, arrow, index, phase: index * 0.173 };
      refreshEdge(view);
      packet.position.copy(view.curve.getPoint((0.35 + view.phase) % 1));
      edgeViews.push(view);
    });
    makeAtmosphere();
    updateCamera(!animating());
    if (startup && animating()) cameraDistance = desiredDistance * 1.22;
    startup = false;
    updateAppearance();
    requestRender();
  }

  function updateAppearance() {
    const activeEdge = flowStep >= 0 ? edgeViews[flowStep % Math.max(edgeViews.length, 1)] : null;
    nodeViews.forEach((view) => {
      const selected = view.node.id === selectedId;
      const hovered = view.node.id === hoveredId;
      const inStep = activeEdge && (view.node.id === activeEdge.edge.from || view.node.id === activeEdge.edge.to);
      const highlighted = selected || hovered || inStep;
      view.button.setAttribute('aria-pressed', String(selected));
      view.button.classList.toggle('is-selected', selected);
      view.button.classList.toggle('is-active', Boolean(inStep));
      if (fallback) {
        view.button.style.borderColor = highlighted ? '#9befbf' : '#28694d';
        view.button.style.background = selected ? '#235e3d' : '#10372a';
        view.button.style.color = '#d4fce5';
        return;
      }
      view.button.style.borderColor = 'transparent';
      view.button.style.background = 'transparent';
      view.button.style.color = view.labelSprite ? 'transparent' : '#d4fce5';
      view.core.material.emissiveIntensity = highlighted ? 2.7 : (Number(view.node.size) >= 2 ? 1.65 : 1.08);
      view.outline.material.opacity = highlighted ? 1 : 0.52;
      view.coreOutline.material.opacity = highlighted ? 1 : 0.76;
      if (view.glow) view.glow.material.opacity = highlighted ? 0.68 : (Number(view.node.size) >= 2 ? 0.55 : 0.34);
      if (view.labelSprite) view.labelSprite.material.opacity = highlighted ? 1 : 0.86;
    });
    edgeViews.forEach((view) => {
      const connected = selectedId === view.edge.from || selectedId === view.edge.to;
      const inStep = activeEdge === view;
      view.line.material.opacity = inStep ? 1 : selectedId ? connected ? 0.9 : 0.15 : 0.57;
      view.line.material.color.set(inStep || connected ? '#b9ffda' : '#8cf0b8').multiplyScalar(inStep || connected ? 2.5 : 1.8);
      view.haze.material.opacity = inStep || connected ? 0.16 : 0.06;
      view.arrow.material.opacity = inStep || connected ? 1 : selectedId ? 0.28 : 0.7;
      view.packet.visible = !activeEdge || inStep;
    });
  }

  function projectLabels() {
    const pixelScale = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height;
    nodeViews.forEach((view) => {
      if (view.labelSprite) {
        view.labelSprite.scale.set(view.label.width * pixelScale, view.label.height * pixelScale, 1);
        view.labelSprite.getWorldPosition(worldPosition);
        view.button.style.width = `${view.label.width}px`;
        view.button.style.height = `${view.label.height}px`;
      } else {
        view.group.getWorldPosition(worldPosition);
        worldPosition.y += view.labelHeight;
      }
      projected.copy(worldPosition).project(camera);
      const visible = projected.z > -1 && projected.z < 1;
      view.button.style.visibility = visible ? 'visible' : 'hidden';
      view.button.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
      view.button.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
      view.button.style.zIndex = String(Math.round((1 - projected.z) * 10000));
    });
  }

  function disposeComposer() {
    composer?.passes.forEach((pass) => pass.dispose?.());
    composer?.dispose();
    composer = null;
    bloom = null;
  }

  function renderFrame(timestamp) {
    frame = null;
    if (destroyed || fallback || document.hidden) return;
    const moving = animating();
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.06) : 0;
    lastFrame = moving ? timestamp : 0;
    if (moving) {
      elapsed += delta;
      const smoothing = 1 - Math.exp(-delta * 4);
      if (layoutMoving) {
        let remaining = false;
        nodeViews.forEach((view) => {
          view.group.position.lerp(view.targetPosition, smoothing);
          if (view.group.position.distanceToSquared(view.targetPosition) > 0.0004) remaining = true;
          else view.group.position.copy(view.targetPosition);
        });
        edgeViews.forEach(refreshEdge);
        layoutMoving = remaining;
      }
      updateCamera();
      cameraDistance = THREE.MathUtils.lerp(cameraDistance, desiredDistance, smoothing);
      cameraAim.lerp(desiredAim, smoothing);
      parallax.lerp(desiredParallax, smoothing);
      updateCamera();
      edgeViews.forEach((view) => {
        const progress = (elapsed * 0.12 + view.phase) % 1;
        view.packet.position.copy(view.curve.getPoint(progress));
        view.packet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), view.curve.getTangent(progress).normalize());
      });
      nodeViews.forEach((view) => {
        view.rim.rotation.z = elapsed * 0.045 + view.phase;
        if (view.glow) {
          const wave = 1 + Math.sin(elapsed * 0.72 + view.phase) * 0.035;
          view.glow.scale.set(view.footprint * 5.2 * wave, view.footprint * 5.2 * wave, 1);
        }
      });
    }
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    projectLabels();
    try {
      if (composer) composer.render(delta);
      else renderer.render(scene, camera);
    } catch {
      if (composer) {
        disposeComposer();
        try { renderer.render(scene, camera); }
        catch { enterFallback(); return; }
      } else { enterFallback(); return; }
    }
    if (moving) requestRender();
  }

  function pick(clientX, clientY) {
    if (fallback || !renderer) return null;
    const rectangle = renderer.domElement.getBoundingClientRect();
    pointerNdc.set((clientX - rectangle.left) / rectangle.width * 2 - 1,
      -((clientY - rectangle.top) / rectangle.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    return raycaster.intersectObjects(raycastTargets, false)[0]?.object.userData.nodeId || null;
  }

  function pointerDown(event) {
    if (fallback || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const onLabel = Boolean(event.target.closest?.('.atlas-label'));
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false, onLabel };
    if (!onLabel) root.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (fallback) return;
    if (pointer && pointer.id === event.pointerId) {
      const deltaX = event.clientX - pointer.x;
      const deltaY = event.clientY - pointer.y;
      if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5) pointer.dragged = true;
      if (pointer.dragged) {
        rotation.rotation.y += deltaX * 0.006;
        rotation.rotation.x = THREE.MathUtils.clamp(rotation.rotation.x + deltaY * 0.0045, -0.7, 0.55);
        root.style.cursor = 'grabbing';
        notifyHover(null);
        updateCamera(!animating());
        requestRender();
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      return;
    }
    if (event.target.closest?.('.atlas-label')) return;
    const rectangle = root.getBoundingClientRect();
    desiredParallax.set((event.clientX - rectangle.left) / Math.max(rectangle.width, 1) * 2 - 1,
      -((event.clientY - rectangle.top) / Math.max(rectangle.height, 1) * 2 - 1));
    updateCamera(!animating());
    requestRender();
    const id = pick(event.clientX, event.clientY);
    root.style.cursor = id ? 'pointer' : 'grab';
    notifyHover(id);
  }

  function pointerUp(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const finished = pointer;
    pointer = null;
    root.style.cursor = 'grab';
    if (finished.dragged) suppressClickUntil = performance.now() + 350;
    else if (!finished.onLabel && event.type !== 'pointercancel') {
      const id = pick(event.clientX, event.clientY);
      if (id) onSelect(id);
    }
    if (root.hasPointerCapture?.(event.pointerId)) root.releasePointerCapture(event.pointerId);
  }

  function pointerLeave() {
    if (!pointer) {
      desiredParallax.set(0, 0);
      notifyHover(null);
      updateCamera(!animating());
      requestRender();
    }
  }

  function wheel(event) {
    if (fallback) return;
    event.preventDefault();
    zoom(event.deltaY * 0.0012);
  }

  function visibilityChanged() {
    if (document.hidden) stopFrame();
    else requestRender();
  }

  function motionPreferenceChanged() {
    stopFrame();
    if (!animating()) settle();
    requestRender();
  }

  function resize() {
    if (destroyed || fallback) return;
    const rectangle = container.getBoundingClientRect();
    width = Math.max(rectangle.width, 1);
    height = Math.max(rectangle.height, 1);
    camera.aspect = width / height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(width, height);
    updateCamera();
    requestRender();
  }

  function setSelection(id) {
    selectedId = id || null;
    updateAppearance();
    requestRender();
  }

  function setStep(index) {
    flowStep = Number.isFinite(index) ? Math.floor(index) : -1;
    updateAppearance();
    requestRender();
  }

  function setMotion(enabled) {
    requestedMotion = Boolean(enabled);
    stopFrame();
    if (!animating()) settle();
    requestRender();
  }

  function reset() {
    focusId = null;
    rotation.rotation.set(-0.02, -0.18, 0);
    desiredParallax.set(0, 0);
    zoomFactor = 1;
    updateCamera(!animating());
    requestRender();
  }

  /** Positive delta moves away from the graph; negative delta moves closer. */
  function zoom(delta) {
    if (!Number.isFinite(delta)) return;
    zoomFactor = THREE.MathUtils.clamp(zoomFactor * Math.exp(delta), 0.46, 2.2);
    updateCamera(!animating());
    requestRender();
  }

  function focus(id) {
    focusId = nodeViews.some((view) => view.node.id === id) ? id : null;
    updateCamera(!animating());
    requestRender();
  }

  function settle() {
    if (layoutMoving) {
      nodeViews.forEach((view) => view.group.position.copy(view.targetPosition));
      edgeViews.forEach(refreshEdge);
      layoutMoving = false;
    }
    updateCamera(true);
  }

  root.addEventListener('pointerdown', pointerDown);
  root.addEventListener('pointermove', pointerMove);
  root.addEventListener('pointerleave', pointerLeave);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);
  root.addEventListener('wheel', wheel, { passive: false });
  document.addEventListener('visibilitychange', visibilityChanged);
  reducedMotion.addEventListener('change', motionPreferenceChanged);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(container);
  if (!observer) window.addEventListener('resize', resize);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopFrame();
    observer?.disconnect();
    root.removeEventListener('pointerdown', pointerDown);
    root.removeEventListener('pointermove', pointerMove);
    root.removeEventListener('pointerleave', pointerLeave);
    root.removeEventListener('wheel', wheel);
    if (pointer && root.hasPointerCapture?.(pointer.id)) root.releasePointerCapture(pointer.id);
    pointer = null;
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', pointerUp);
    window.removeEventListener('pointercancel', pointerUp);
    document.removeEventListener('visibilitychange', visibilityChanged);
    reducedMotion.removeEventListener('change', motionPreferenceChanged);
    renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
    disposeObjects(content);
    disposeObjects(atmosphere);
    nodeViews = [];
    edgeViews = [];
    raycastTargets = [];
    graph = { nodes: [], edges: [] };
    labels.replaceChildren();
    halo?.dispose();
    disposeComposer();
    keyLight.shadow.map?.dispose();
    renderer?.dispose();
    root.remove();
    container.style.position = oldPosition;
  }

  resize();
  return { setGraph, setSelection, setStep, setMotion, resize, reset, zoom, focus, destroy };
}
