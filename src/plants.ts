import * as THREE from "three";
import { dimensions, openingProfiles, type OpeningKind } from "./model.ts";

export const plantKinds = [
  "empty",
  "pothos",
  "snake",
  "monstera",
  "succulent",
  "oxalis",
  "asparagus",
] as const;
export type PlantKind = (typeof plantKinds)[number];
type LeafShape = "heart" | "sword" | "split" | "succulent" | "triangle";

export const soilHeightMM = dimensions.height - 6;
const sphereCenterHeightMM = 62;
const cavityRadiusMM = dimensions.diameter / 2 - dimensions.wall;
const soilRadiusMM =
  Math.sqrt(cavityRadiusMM ** 2 - (soilHeightMM - sphereCenterHeightMM) ** 2) -
  0.8;

export interface PlantPreview {
  group: THREE.Group;
  soil: THREE.Group;
  canopy: THREE.Group;
  dispose(): void;
}

export function positionPlantPreview(
  preview: PlantPreview,
  opening: OpeningKind,
  bodyLiftMM: number,
) {
  const profile = openingProfiles[opening];
  const compactRosette =
    opening === "diagonal" && preview.group.name === "succulent";
  preview.canopy.position.z = compactRosette ? 3 : 0;
  preview.canopy.scale.setScalar(compactRosette ? 0.85 : 1);
  const angle = THREE.MathUtils.degToRad(profile.angleDegrees);
  const openingSoilRadius =
    Math.sqrt(cavityRadiusMM ** 2 - profile.soilDistanceMM ** 2) - 0.8;
  const radialScale = openingSoilRadius / soilRadiusMM;
  preview.group.rotation.y = angle;
  preview.group.scale.set(radialScale, radialScale, 1);
  preview.group.position.set(
    Math.sin(angle) * profile.soilDistanceMM,
    0,
    sphereCenterHeightMM +
      Math.cos(angle) * profile.soilDistanceMM +
      bodyLiftMM,
  );
}

function leafWidth(shape: LeafShape, lengthPosition: number, side: number) {
  if (shape === "triangle") return lengthPosition;
  const taper = Math.sin(Math.PI * lengthPosition);
  if (shape === "sword") return taper ** 0.65 * (1 - 0.25 * lengthPosition);
  if (shape === "succulent") return taper ** 0.75;
  let width =
    shape === "split"
      ? taper ** 0.48 * (1.3 - 0.45 * lengthPosition)
      : taper ** 0.65 * (1.25 - 0.7 * lengthPosition);
  if (shape === "split") {
    for (const splitPosition of [0.43, 0.67, 0.83]) {
      const distance = (lengthPosition - splitPosition - side * 0.026) / 0.018;
      width *= 1 - 0.53 * Math.exp(-(distance ** 2));
    }
  }
  return width;
}

function leafSurfaceHeight(
  shape: LeafShape,
  lengthPosition: number,
  widthPosition: number,
) {
  const arch = Math.sin(Math.PI * lengthPosition);
  const fold = shape === "sword" ? 0.018 : 0.07;
  return (
    arch * (0.06 - fold * Math.abs(widthPosition)) - 0.1 * lengthPosition ** 3
  );
}

function leafColor(
  shape: LeafShape,
  lengthPosition: number,
  widthPosition: number,
) {
  const edge = Math.abs(widthPosition);
  if (shape === "triangle") {
    const centerFold = Math.exp(-edge * 8) * 0.4;
    return new THREE.Color("#492548").lerp(
      new THREE.Color("#995083"),
      centerFold + (widthPosition > 0 ? 0.15 : 0),
    );
  }
  if (shape === "sword") {
    const band = Math.sin(lengthPosition * 105 + widthPosition * 2) * 0.5 + 0.5;
    return edge > 0.83
      ? new THREE.Color("#b2b45f")
      : new THREE.Color("#254d36").lerp(
          new THREE.Color("#69836b"),
          band * 0.65,
        );
  }
  if (shape === "succulent") {
    return new THREE.Color("#6f9987").lerp(
      new THREE.Color("#b4c6ad"),
      edge ** 4 * 0.6 + lengthPosition * 0.15,
    );
  }
  const color = new THREE.Color(shape === "heart" ? "#357343" : "#245b37");
  const midrib = Math.exp(-edge * 45) * 0.25;
  const vein =
    Math.pow(Math.max(0, Math.cos((lengthPosition - edge * 0.28) * 48)), 18) *
    0.08;
  const variegation =
    shape === "heart"
      ? Math.max(
          0,
          Math.sin(lengthPosition * 19 + widthPosition * 8) *
            Math.cos(lengthPosition * 31 - widthPosition * 13) -
            0.35,
        ) * 0.8
      : 0;
  return color.lerp(new THREE.Color("#b1be66"), midrib + vein + variegation);
}

function createLeafGeometry(shape: LeafShape) {
  const lengthSegments = shape === "split" ? 96 : 40;
  const widthSegments = 16;
  const positions: number[] = [];
  const colors: number[] = [];
  const triangles: number[] = [];
  const surfaceCount = shape === "succulent" ? 2 : 1;
  const verticesPerSurface = (lengthSegments + 1) * (widthSegments + 1);

  for (let surface = 0; surface < surfaceCount; surface++) {
    for (let row = 0; row <= lengthSegments; row++) {
      const lengthPosition = row / lengthSegments;
      for (let column = 0; column <= widthSegments; column++) {
        const widthPosition = (column / widthSegments) * 2 - 1;
        const width = leafWidth(
          shape,
          lengthPosition,
          Math.sign(widthPosition),
        );
        const heartLobes =
          shape === "heart" || shape === "split"
            ? 0.19 *
              Math.sin(Math.PI * Math.sqrt(lengthPosition)) *
              Math.abs(widthPosition) ** 2
            : 0;
        const thickness =
          shape === "succulent"
            ? (surface === 0 ? 1 : -1) *
              0.13 *
              Math.sin(Math.PI * lengthPosition) *
              Math.sqrt(1 - widthPosition ** 2)
            : 0;
        positions.push(
          widthPosition * width,
          lengthPosition -
            heartLobes +
            (shape === "triangle"
              ? Math.abs(widthPosition) * lengthPosition * 0.12
              : 0),
          leafSurfaceHeight(shape, lengthPosition, widthPosition) + thickness,
        );
        const color = leafColor(shape, lengthPosition, widthPosition);
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let row = 0; row < lengthSegments; row++) {
      for (let column = 0; column < widthSegments; column++) {
        const lengthPosition = (row + 0.5) / lengthSegments;
        const widthPosition = ((column + 0.5) / widthSegments) * 2 - 1;
        const fenestration =
          shape === "split" &&
          [0.25, 0.48].some(
            (center) =>
              ((lengthPosition - center) / 0.05) ** 2 +
                ((Math.abs(widthPosition) - 0.42) / 0.13) ** 2 <
              1,
          );
        if (fenestration) continue;
        const first =
          surface * verticesPerSurface + row * (widthSegments + 1) + column;
        const nextRow = first + widthSegments + 1;
        if (surface === 0)
          triangles.push(
            first,
            first + 1,
            nextRow,
            first + 1,
            nextRow + 1,
            nextRow,
          );
        else
          triangles.push(
            first,
            nextRow,
            first + 1,
            first + 1,
            nextRow,
            nextRow + 1,
          );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createSoil() {
  const soil = new THREE.Group();
  soil.name = "soil";
  const soilMaterial = new THREE.MeshStandardMaterial({
    color: "#30261e",
    roughness: 1,
  });
  const surface = new THREE.Mesh(
    new THREE.CylinderGeometry(soilRadiusMM, soilRadiusMM, 2, 64),
    soilMaterial,
  );
  surface.rotation.x = Math.PI / 2;
  surface.position.z = -1;
  surface.receiveShadow = true;
  soil.add(surface);

  const grainGeometry = new THREE.IcosahedronGeometry(0.85, 0);
  const grainMaterial = new THREE.MeshStandardMaterial({
    color: "#75604a",
    roughness: 1,
  });
  const grains = new THREE.InstancedMesh(grainGeometry, grainMaterial, 100);
  const transform = new THREE.Object3D();
  for (let index = 0; index < 100; index++) {
    const angle = index * 2.399963;
    const radius = Math.sqrt((index + 0.5) / 100) * (soilRadiusMM - 1);
    transform.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      -0.12,
    );
    transform.scale.set(
      0.7 + (index % 4) * 0.18,
      0.6 + (index % 3) * 0.2,
      0.35,
    );
    transform.rotation.z = angle;
    transform.updateMatrix();
    grains.setMatrixAt(index, transform.matrix);
  }
  grains.receiveShadow = true;
  soil.add(grains);
  return soil;
}

export function createPlantPreview(kind: PlantKind): PlantPreview {
  const group = new THREE.Group();
  group.name = kind;
  const soil = new THREE.Group();
  const canopy = new THREE.Group();
  const leafGeometries = new Map<LeafShape, THREE.BufferGeometry>();
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.58,
  });
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: kind === "oxalis" ? "#78465d" : "#486538",
    roughness: 0.85,
  });

  function addStem(points: THREE.Vector3[], radius = 0.9) {
    const curve = new THREE.CatmullRomCurve3(points);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, radius, 6, false),
      stemMaterial,
    );
    stem.castShadow = true;
    canopy.add(stem);
    return curve;
  }

  function addLeaf(
    shape: LeafShape,
    base: THREE.Vector3,
    direction: THREE.Vector3,
    lengthMM: number,
    halfWidthMM: number,
    roll = 0,
  ) {
    let geometry = leafGeometries.get(shape);
    if (!geometry) {
      geometry = createLeafGeometry(shape);
      leafGeometries.set(shape, geometry);
    }
    const leaf = new THREE.Mesh(geometry, leafMaterial);
    leaf.name = `${shape}-leaf`;
    leaf.position.copy(base);
    leaf.scale.set(halfWidthMM, lengthMM, lengthMM);
    const leafDirection = direction.clone().normalize();
    leaf.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      leafDirection,
    );
    leaf.quaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(leafDirection, roll),
    );
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    canopy.add(leaf);
  }

  function addPothos() {
    for (let index = 0; index < 10; index++) {
      const angle = index * 2.399963;
      const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const attachment = radial
        .clone()
        .multiplyScalar(16 + (index % 3) * 5)
        .setZ(22 + (index % 4) * 9);
      addStem([
        radial.clone().multiplyScalar(5),
        attachment
          .clone()
          .multiplyScalar(0.5)
          .add(new THREE.Vector3(0, 0, 8)),
        attachment,
      ]);
      addLeaf(
        "heart",
        attachment,
        radial.clone().setZ(0.05 - (index % 3) * 0.23),
        31 + (index % 4) * 4,
        14 + (index % 3) * 2,
        ((index % 3) - 1) * 0.3,
      );
    }
    for (const [vineIndex, angle] of [-2.8, -0.4, 1.3].entries()) {
      const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const vine = addStem(
        [
          radial.clone().multiplyScalar(5),
          radial.clone().multiplyScalar(26).setZ(38),
          radial.clone().multiplyScalar(65).setZ(42),
          radial.clone().multiplyScalar(91).setZ(5),
          radial
            .clone()
            .multiplyScalar(100 + vineIndex * 8)
            .setZ(-45 - vineIndex * 9),
        ],
        1.05,
      );
      for (let index = 0; index < 7; index++) {
        const attachment = vine.getPoint(0.21 + index * 0.115);
        const sideAngle = angle + (index % 2 ? 0.65 : -0.65);
        const direction = new THREE.Vector3(
          Math.cos(sideAngle),
          Math.sin(sideAngle),
          index < 2 ? 0.2 : -0.7,
        );
        const petioleEnd = attachment.clone().addScaledVector(direction, 5);
        addStem(
          [
            attachment,
            attachment
              .clone()
              .lerp(petioleEnd, 0.5)
              .add(new THREE.Vector3(0, 0, 2)),
            petioleEnd,
          ],
          0.55,
        );
        addLeaf(
          "heart",
          petioleEnd,
          direction,
          29 - index * 1.1,
          12 - index * 0.3,
          (index % 2 ? 1 : -1) * 0.35,
        );
      }
    }
  }

  function addSnakePlant() {
    for (let index = 0; index < 9; index++) {
      const angle = index * 2.399963;
      const radius = index < 3 ? 7 : 17;
      const base = new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        -1,
      );
      const direction = new THREE.Vector3(
        Math.cos(angle) * 0.2,
        Math.sin(angle) * 0.2,
        1,
      );
      addLeaf(
        "sword",
        base,
        direction,
        100 + ((index * 29) % 66),
        7 + (index % 3) * 1.4,
        Math.sin(angle) * 0.5,
      );
    }
  }

  function addMonstera() {
    for (let index = 0; index < 6; index++) {
      const angle = index * 2.399963 + 0.4;
      const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const attachment = radial
        .clone()
        .multiplyScalar(22 + (index % 3) * 10)
        .setZ(49 + (index % 4) * 17);
      addStem(
        [
          radial.clone().multiplyScalar(6),
          attachment
            .clone()
            .multiplyScalar(0.45)
            .add(new THREE.Vector3(0, 0, 12)),
          attachment,
        ],
        1.35,
      );
      addLeaf(
        "split",
        attachment,
        radial.clone().setZ(index % 3 === 0 ? 0.7 : 0.2),
        74 + (index % 3) * 9,
        34 + (index % 3) * 4,
        ((index % 3) - 1) * 0.22,
      );
    }
  }

  function addSucculent() {
    for (let layer = 0; layer < 3; layer++) {
      const leafCount = 11 - layer * 3;
      for (let index = 0; index < leafCount; index++) {
        const angle = (index / leafCount) * Math.PI * 2 + layer * 0.45;
        const base = new THREE.Vector3(
          Math.cos(angle) * 3,
          Math.sin(angle) * 3,
          3 + layer * 3,
        );
        const direction = new THREE.Vector3(
          Math.cos(angle),
          Math.sin(angle),
          0.25 + layer * 0.55,
        );
        addLeaf("succulent", base, direction, 37 - layer * 8, 12 - layer * 2);
      }
    }
  }

  function addOxalis() {
    for (let index = 0; index < 12; index++) {
      const angle = index * 2.399963;
      const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const attachment = radial
        .clone()
        .multiplyScalar(12 + (index % 4) * 7)
        .setZ(33 + (index % 5) * 10);
      addStem(
        [
          radial.clone().multiplyScalar(5),
          attachment
            .clone()
            .multiplyScalar(0.5)
            .add(new THREE.Vector3(0, 0, 6)),
          attachment,
        ],
        0.5,
      );
      for (let leaflet = 0; leaflet < 3; leaflet++) {
        const leafletAngle = angle + (leaflet * Math.PI * 2) / 3;
        const direction = new THREE.Vector3(
          Math.cos(leafletAngle),
          Math.sin(leafletAngle),
          -0.08 - (index % 3) * 0.14,
        );
        addLeaf(
          "triangle",
          attachment,
          direction,
          21 + (index % 3) * 3,
          17 + (index % 3) * 2,
          0,
        );
      }
    }
  }

  function addAsparagusFern() {
    const needles: {
      base: THREE.Vector3;
      direction: THREE.Vector3;
      length: number;
    }[] = [];
    for (let frond = 0; frond < 10; frond++) {
      const angle = frond * 2.399963;
      const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const sideways = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
      const height = 72 + (frond % 4) * 17;
      const spread = 48 + (frond % 3) * 12;
      const axis = addStem(
        [
          radial.clone().multiplyScalar(4),
          radial
            .clone()
            .multiplyScalar(12)
            .setZ(height * 0.55),
          radial
            .clone()
            .multiplyScalar(spread * 0.6)
            .setZ(height),
          radial
            .clone()
            .multiplyScalar(spread)
            .setZ(height * 0.84),
        ],
        0.55,
      );
      for (let branch = 0; branch < 13; branch++) {
        const progress = 0.23 + branch * 0.057;
        const attachment = axis.getPoint(progress);
        const branchLength = Math.sin(progress * Math.PI) * 19 + 3;
        for (const side of [-1, 1]) {
          const branchDirection = sideways
            .clone()
            .multiplyScalar(side)
            .addScaledVector(radial, 0.3)
            .setZ(0.18)
            .normalize();
          const endpoint = attachment
            .clone()
            .addScaledVector(branchDirection, branchLength);
          addStem(
            [
              attachment,
              attachment
                .clone()
                .lerp(endpoint, 0.5)
                .add(new THREE.Vector3(0, 0, 1)),
              endpoint,
            ],
            0.2,
          );
          for (let needle = 0; needle < 6; needle++) {
            const base = attachment.clone().lerp(endpoint, (needle + 1) / 7);
            for (const needleSide of [-1, 1]) {
              needles.push({
                base,
                direction: radial
                  .clone()
                  .multiplyScalar(needleSide)
                  .addScaledVector(branchDirection, 0.4)
                  .setZ(0.3)
                  .normalize(),
                length: (8.5 - needle * 0.65) * (1 - progress * 0.3),
              });
            }
          }
        }
      }
    }
    const needleGeometry = new THREE.ConeGeometry(0.32, 1, 3);
    needleGeometry.translate(0, 0.5, 0);
    const needleMaterial = new THREE.MeshStandardMaterial({
      color: "#527e3e",
      roughness: 0.85,
    });
    const foliage = new THREE.InstancedMesh(
      needleGeometry,
      needleMaterial,
      needles.length,
    );
    foliage.name = "fern-needles";
    const transform = new THREE.Object3D();
    for (const [index, needle] of needles.entries()) {
      transform.position.copy(needle.base);
      transform.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        needle.direction,
      );
      transform.scale.set(1, needle.length, 1);
      transform.updateMatrix();
      foliage.setMatrixAt(index, transform.matrix);
    }
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    canopy.add(foliage);
  }

  if (kind !== "empty") {
    soil.add(createSoil());
    group.add(soil, canopy);
    const builders = {
      pothos: addPothos,
      snake: addSnakePlant,
      monstera: addMonstera,
      succulent: addSucculent,
      oxalis: addOxalis,
      asparagus: addAsparagusFern,
    };
    builders[kind]();
  }

  return {
    group,
    soil,
    canopy,
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(leafGeometries.values());
      const materials = new Set<THREE.Material>([leafMaterial, stemMaterial]);
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const meshMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        meshMaterials.forEach((material) => materials.add(material));
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      group.removeFromParent();
    },
  };
}
