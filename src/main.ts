import "@fontsource-variable/inter";
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { dimensions } from "./model.ts";

type BackgroundMode = "auto" | "dark" | "light";
type ModelView = "assembled" | "exploded" | "section";
type PlanterMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

interface ModelMeshes {
  body: PlanterMesh;
  saucer: PlanterMesh;
  section: PlanterMesh;
}

function requiredElement<T extends HTMLElement = HTMLElement>(
  selector: string,
): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function selectButton(
  buttons: NodeListOf<HTMLButtonElement>,
  selectedButton: HTMLButtonElement,
) {
  for (const button of buttons) {
    const selected = button === selectedButton;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function createRenderer(viewport: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  viewport.appendChild(renderer.domElement);
  return renderer;
}

function addStudioLighting(scene: THREE.Scene) {
  const ambientLight = new THREE.HemisphereLight(0xfffcf4, 0xb2b7a3, 2.4);
  const keyLight = new THREE.DirectionalLight(0xfff8e9, 3.8);
  keyLight.position.set(-160, -180, 300);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  Object.assign(keyLight.shadow.camera, {
    left: -180,
    right: 180,
    top: 180,
    bottom: -180,
    near: 1,
    far: 700,
  });
  keyLight.shadow.bias = -0.0003;
  keyLight.shadow.normalBias = 0.15;
  keyLight.shadow.radius = 4;

  const fillLight = new THREE.DirectionalLight(0xf3f7ff, 1.6);
  fillLight.position.set(180, 100, 180);
  scene.add(ambientLight, keyLight, fillLight);
}

function createShadowGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.ShadowMaterial({ opacity: 0.12 }),
  );
  ground.position.z = -0.2;
  ground.receiveShadow = true;
  return ground;
}

async function loadModelMeshes(
  material: THREE.MeshStandardMaterial,
): Promise<ModelMeshes> {
  const loader = new STLLoader();
  const geometries = await Promise.all(
    ["planter", "saucer", "section"].map((name) =>
      loader.loadAsync(`/models/orbital-${name}.stl`),
    ),
  );
  const [body, saucer, section] = geometries.map((geometry) => {
    const shadedGeometry = toCreasedNormals(geometry, Math.PI / 5);
    const mesh = new THREE.Mesh(shadedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (shadedGeometry !== geometry) geometry.dispose();
    return mesh;
  });
  body.position.z = dimensions.assemblyLift;
  section.position.z = dimensions.assemblyLift;
  section.visible = false;
  return { body, saucer, section };
}

function relativeLuminance(linearColor: THREE.Color) {
  return (
    0.2126 * linearColor.r + 0.7152 * linearColor.g + 0.0722 * linearColor.b
  );
}

const viewport = requiredElement("#viewport");
const loading = requiredElement("#loading");
const studio = requiredElement(".studio");
const backgroundButtons = document.querySelectorAll<HTMLButtonElement>(
  "button[data-background]",
);
const finishButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-color]");
const viewButtons = document.querySelectorAll<HTMLButtonElement>("[data-view]");
const rotateButton = requiredElement<HTMLButtonElement>("#rotate");
const resetButton = requiredElement<HTMLButtonElement>("#reset");
const renderer = createRenderer(viewport);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 2000);
camera.up.set(0, 0, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 185;
controls.maxDistance = 700;
controls.maxPolarAngle = Math.PI * 0.87;
controls.autoRotateSpeed = 0.7;

const ground = createShadowGround();
const material = new THREE.MeshStandardMaterial({
  color: "#d8d3c6",
  roughness: 0.83,
  metalness: 0,
});
let modelMeshes: ModelMeshes | undefined;
let targetBodyHeightMM: number = dimensions.assemblyLift;
let backgroundMode: BackgroundMode = "auto";

function resetCamera() {
  camera.position.set(0, -390, 195);
  controls.target.set(0, 0, 53);
  controls.update();
}

function updateBackground() {
  const contrastingBackground =
    relativeLuminance(material.color) > 0.18 ? "dark" : "light";
  const background =
    backgroundMode === "auto" ? contrastingBackground : backgroundMode;
  studio.dataset.background = background;
  ground.material.opacity = background === "dark" ? 0.3 : 0.12;
}

function setModelView(view: ModelView) {
  if (!modelMeshes) return;
  modelMeshes.body.visible = view !== "section";
  modelMeshes.section.visible = view === "section";
  targetBodyHeightMM = view === "exploded" ? 42 : dimensions.assemblyLift;

  if (view === "section") {
    camera.position.set(120, -350, 170);
    controls.target.set(0, 0, 55);
  }
}

for (const button of backgroundButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset.background;
    if (mode !== "auto" && mode !== "dark" && mode !== "light") return;
    backgroundMode = mode;
    updateBackground();
    selectButton(backgroundButtons, button);
  });
}

for (const button of finishButtons) {
  button.addEventListener("click", () => {
    const color = button.dataset.color;
    if (!color) return;
    material.color.set(color);
    updateBackground();
    selectButton(finishButtons, button);
  });
}

for (const button of viewButtons) {
  button.addEventListener("click", () => {
    if (!modelMeshes) return;
    const view = button.dataset.view;
    if (view !== "assembled" && view !== "exploded" && view !== "section")
      return;
    setModelView(view);
    selectButton(viewButtons, button);
  });
}

rotateButton.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  rotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
});
resetButton.addEventListener("click", resetCamera);

new ResizeObserver(() => {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(viewport);

resetCamera();
updateBackground();
addStudioLighting(scene);
scene.add(ground);

try {
  modelMeshes = await loadModelMeshes(material);
  scene.add(modelMeshes.body, modelMeshes.saucer, modelMeshes.section);
  loading.remove();
} catch (error) {
  loading.textContent = "Unable to load the model. Refresh to try again.";
  console.error(error);
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const elapsedSeconds = Math.min(clock.getDelta(), 0.1);
  if (modelMeshes) {
    const { body, section } = modelMeshes;
    body.position.z = THREE.MathUtils.damp(
      body.position.z,
      targetBodyHeightMM,
      8,
      elapsedSeconds,
    );
    section.position.z = body.position.z;
  }
  controls.update(elapsedSeconds);
  renderer.render(scene, camera);
});
