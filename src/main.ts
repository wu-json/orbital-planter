import "@fontsource-variable/inter";
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { dimensions, modelAssetPath, type OpeningKind } from "./model.ts";
import { createPlacePicker } from "./place-picker.ts";
import { createPlacePreview, officeStyles, type PlaceKind } from "./places.ts";
import { createPlantPicker } from "./plant-picker.ts";
import {
  createPlantPreview,
  positionPlantPreview,
  type PlantKind,
} from "./plants.ts";

import {
  loadViewerSettings,
  saveViewerSettings,
  type BackgroundMode,
  type ModelView,
} from "./settings.ts";
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
  const lights = new THREE.Group();
  lights.add(ambientLight, keyLight, fillLight);
  scene.add(lights);
  return lights;
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
  opening: OpeningKind,
): Promise<ModelMeshes> {
  const loader = new STLLoader();
  const geometries = await Promise.all(
    ["planter", "saucer", "section"].map((name) =>
      loader.loadAsync(modelAssetPath(opening, `orbital-${name}.stl`)),
    ),
  );
  const [body, saucer, section] = geometries.map((geometry) => {
    const shadedGeometry = toCreasedNormals(geometry, Math.PI / 5);
    shadedGeometry.computeBoundingBox();
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
const openingButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-opening]");
const downloadLink = requiredElement<HTMLAnchorElement>(".download");
const savedSettings = loadViewerSettings(
  [...finishButtons].flatMap((button) =>
    button.dataset.color ? [button.dataset.color] : [],
  ),
);

const renderer = createRenderer(viewport);
const scene = new THREE.Scene();
const studioLights = addStudioLighting(scene);
const backgroundControl = requiredElement(".background-control");
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
  color: savedSettings.finish,
  roughness: 0.83,
  metalness: 0,
});
let modelMeshes: ModelMeshes | undefined;
let modelVariants: Record<OpeningKind, ModelMeshes> | undefined;
let selectedOpening: OpeningKind = savedSettings.opening;
let targetBodyHeightMM =
  savedSettings.view === "exploded" ? 42 : dimensions.assemblyLift;
let backgroundMode: BackgroundMode = savedSettings.background;
let selectedPlant: PlantKind = savedSettings.plant;
let selectedPlace: PlaceKind = "studio";
let placePreview = createPlacePreview(selectedPlace);
scene.add(placePreview.group);
let currentView: ModelView = savedSettings.view;
let plantPreview = createPlantPreview(selectedPlant);
scene.add(plantPreview.group);

function persistSettings() {
  saveViewerSettings({
    finish: `#${material.color.getHexString()}`,
    background: backgroundMode,
    plant: selectedPlant,
    place: selectedPlace,
    opening: selectedOpening,
    view: currentView,
    rotate: controls.autoRotate,
  });
}

function updateDownloadLink() {
  downloadLink.href = modelAssetPath(selectedOpening, "orbital-planter.zip");
  downloadLink.download =
    selectedOpening === "top"
      ? "orbital-planter.zip"
      : "orbital-planter-diagonal.zip";
}

function resetCamera() {
  const inOffice = selectedPlace !== "studio";
  camera.fov = inOffice ? 40 : 33;
  camera.near = inOffice ? 5 : 0.1;
  camera.far = inOffice ? 12000 : 2000;
  controls.enablePan = !inOffice;
  controls.minDistance = inOffice ? 350 : 185;
  controls.minPolarAngle = inOffice ? Math.PI / 6 : 0;
  controls.maxPolarAngle = inOffice ? Math.PI * 0.44 : Math.PI * 0.87;
  controls.minAzimuthAngle = inOffice ? -Math.PI * 0.28 : -Infinity;
  controls.maxAzimuthAngle = inOffice ? Math.PI * 0.28 : Infinity;
  controls.autoRotateSpeed = 0.7;
  camera.updateProjectionMatrix();
  if (inOffice) {
    controls.target.set(-90, 50, 100);
    const canopyMargin =
      selectedOpening === "diagonal" && selectedPlant !== "empty" ? 1.1 : 1;
    const framingScale = Math.max(1, 0.95 / camera.aspect) * canopyMargin;
    camera.position
      .copy(controls.target)
      .addScaledVector(new THREE.Vector3(90, -700, 300), framingScale);
    controls.maxDistance = camera.position.distanceTo(controls.target) * 1.3;
    controls.update();
    return;
  }
  if (selectedPlant === "empty") {
    camera.position.set(
      currentView === "section" ? 120 : 0,
      currentView === "section" ? -350 : -390,
      currentView === "section" ? 170 : 195,
    );
    controls.target.set(0, 0, currentView === "section" ? 55 : 53);
    controls.maxDistance = 700;
  } else {
    const bounds = new THREE.Box3(
      new THREE.Vector3(-70, -70, 0),
      new THREE.Vector3(
        70,
        70,
        (modelMeshes?.body.geometry.boundingBox?.max.z ?? dimensions.height) +
          targetBodyHeightMM,
      ),
    );
    const plantBounds = new THREE.Box3().setFromObject(plantPreview.group);
    plantBounds.translate(
      new THREE.Vector3(
        0,
        0,
        targetBodyHeightMM -
          (modelMeshes?.body.position.z ?? targetBodyHeightMM),
      ),
    );
    bounds.union(plantBounds);
    const center = bounds.getCenter(new THREE.Vector3());
    const verticalHalfAngle = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalHalfAngle = Math.atan(
      Math.tan(verticalHalfAngle) * camera.aspect,
    );
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    const distance =
      (radius / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle))) *
      1.12;
    const direction = new THREE.Vector3(
      currentView === "section" ? 0.3 : 0,
      -1,
      0.36,
    ).normalize();
    camera.position.copy(center).addScaledVector(direction, distance);
    controls.target.copy(center);
    controls.maxDistance = Math.max(700, distance * 2);
    camera.far = Math.max(2000, distance * 4);
    camera.updateProjectionMatrix();
  }
  controls.update();
}

function setPlant(kind: PlantKind) {
  plantPreview.dispose();
  selectedPlant = kind;
  plantPreview = createPlantPreview(kind);
  positionPlantPreview(
    plantPreview,
    selectedOpening,
    modelMeshes?.body.position.z ?? targetBodyHeightMM,
  );
  plantPreview.soil.visible = currentView !== "section";
  scene.add(plantPreview.group);
  resetCamera();
}

function setOpening(opening: OpeningKind) {
  if (!modelVariants || !modelMeshes) return;
  scene.remove(modelMeshes.body, modelMeshes.saucer, modelMeshes.section);
  selectedOpening = opening;
  modelMeshes = modelVariants[opening];
  modelMeshes.body.position.z = targetBodyHeightMM;
  modelMeshes.section.position.z = targetBodyHeightMM;
  scene.add(modelMeshes.body, modelMeshes.saucer, modelMeshes.section);
  positionPlantPreview(plantPreview, opening, targetBodyHeightMM);
  updateDownloadLink();
  setModelView(currentView);
  resetCamera();
}

function setPlace(kind: PlaceKind) {
  placePreview.dispose();
  selectedPlace = kind;
  placePreview = createPlacePreview(kind);
  scene.add(placePreview.group);
  const inStudio = kind === "studio";
  ground.visible = inStudio;
  studioLights.visible = inStudio;
  backgroundControl.hidden = !inStudio;
  studio.dataset.place = kind;
  scene.background = inStudio
    ? null
    : new THREE.Color(officeStyles[kind].background);
  renderer.toneMappingExposure = inStudio ? 1.5 : officeStyles[kind].exposure;
  updateBackground();
  resetCamera();
}

function updateBackground() {
  if (selectedPlace !== "studio") {
    studio.dataset.background = officeStyles[selectedPlace].theme;
    return;
  }
  const contrastingBackground =
    relativeLuminance(material.color) > 0.18 ? "dark" : "light";
  const background =
    backgroundMode === "auto" ? contrastingBackground : backgroundMode;
  studio.dataset.background = background;
  ground.material.opacity = background === "dark" ? 0.3 : 0.12;
}

function setModelView(view: ModelView) {
  if (!modelMeshes) return;
  currentView = view;
  plantPreview.soil.visible = view !== "section";
  modelMeshes.body.visible = view !== "section";
  modelMeshes.section.visible = view === "section";
  targetBodyHeightMM = view === "exploded" ? 42 : dimensions.assemblyLift;

  if (selectedPlant !== "empty" || selectedPlace !== "studio") {
    resetCamera();
  } else if (view === "section") {
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
    persistSettings();
  });
}

for (const button of finishButtons) {
  button.addEventListener("click", () => {
    const color = button.dataset.color;
    if (!color) return;
    material.color.set(color);
    updateBackground();
    selectButton(finishButtons, button);
    persistSettings();
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
    persistSettings();
  });
}

for (const button of openingButtons) {
  button.addEventListener("click", () => {
    const opening = button.dataset.opening;
    if (!modelVariants || (opening !== "top" && opening !== "diagonal")) return;
    setOpening(opening);
    selectButton(openingButtons, button);
    persistSettings();
  });
}

createPlantPicker(
  requiredElement("#plant-picker"),
  (kind) => {
    setPlant(kind);
    persistSettings();
  },
  savedSettings.plant,
);
createPlacePicker(
  requiredElement("#place-picker"),
  (kind) => {
    setPlace(kind);
    persistSettings();
  },
  savedSettings.place,
);

rotateButton.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  rotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
  persistSettings();
});
resetButton.addEventListener("click", resetCamera);

new ResizeObserver(() => {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (selectedPlant !== "empty" || selectedPlace !== "studio") resetCamera();
}).observe(viewport);

positionPlantPreview(plantPreview, selectedOpening, targetBodyHeightMM);
plantPreview.soil.visible = currentView !== "section";
setPlace(savedSettings.place);
controls.autoRotate = savedSettings.rotate;
rotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
for (const [buttons, key, value] of [
  [finishButtons, "color", savedSettings.finish],
  [backgroundButtons, "background", backgroundMode],
  [viewButtons, "view", currentView],
  [openingButtons, "opening", selectedOpening],
] as const) {
  const selected = [...buttons].find((button) => button.dataset[key] === value);
  if (selected) selectButton(buttons, selected);
}
updateDownloadLink();
scene.add(ground);

try {
  const [top, diagonal] = await Promise.all([
    loadModelMeshes(material, "top"),
    loadModelMeshes(material, "diagonal"),
  ]);
  modelVariants = { top, diagonal };
  modelMeshes = modelVariants[selectedOpening];
  for (const button of openingButtons) button.disabled = false;
  setOpening(selectedOpening);
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
    positionPlantPreview(plantPreview, selectedOpening, body.position.z);
  }
  if (selectedPlace !== "studio" && controls.autoRotate) {
    const angle = controls.getAzimuthalAngle();
    if (angle <= controls.minAzimuthAngle + 0.02)
      controls.autoRotateSpeed = -0.7;
    if (angle >= controls.maxAzimuthAngle - 0.02)
      controls.autoRotateSpeed = 0.7;
  }
  controls.update(elapsedSeconds);
  renderer.render(scene, camera);
});
