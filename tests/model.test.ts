import { test, afterAll } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Module from "manifold-3d";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import {
  createModel,
  dimensions,
  modelAssetPath,
  openingKinds,
} from "../src/model.ts";
import { binarySTL } from "../src/stl.ts";
import { unzipSync } from "fflate";
const kernel = await Module();
kernel.setup();
const model = createModel(kernel);
const diagonalModel = createModel(kernel, 192, "diagonal");
const variants = { top: model, diagonal: diagonalModel };

test("printable parts are closed, connected solids with positive volume", () => {
  for (const [name, part] of [
    ["body", model.body],
    ["saucer", model.saucer],
    ["diagonal", diagonalModel.body],
  ] as const) {
    assert.equal(part.status(), "NoError");
    assert.ok(part.volume() > 0);
    const components = part.decompose();
    assert.equal(components.length, 1, `${name} has no detached pieces`);
    components.forEach((component) => component.delete());
    const mesh = part.getMesh();
    const edges = new Map<string, { faceCount: number; windingSum: number }>();
    for (
      let triangleOffset = 0;
      triangleOffset < mesh.triVerts.length;
      triangleOffset += 3
    ) {
      for (let corner = 0; corner < 3; corner++) {
        const startVertex = mesh.triVerts[triangleOffset + corner];
        const endVertex = mesh.triVerts[triangleOffset + ((corner + 1) % 3)];
        const edgeKey = `${Math.min(startVertex, endVertex)},${Math.max(startVertex, endVertex)}`;
        const edge = edges.get(edgeKey) ?? { faceCount: 0, windingSum: 0 };
        edge.faceCount++;
        edge.windingSum += startVertex < endVertex ? 1 : -1;
        edges.set(edgeKey, edge);
      }
    }
    for (const [edgeKey, { faceCount, windingSum }] of edges) {
      assert.equal(faceCount, 2, `${name} edge ${edgeKey} is watertight`);
      assert.equal(
        windingSum,
        0,
        `${name} edge ${edgeKey} has consistent winding`,
      );
    }
  }
});
test("body and saucer dimensions match their specification", () => {
  const bodyBounds = model.body.boundingBox();
  assert.deepEqual(bodyBounds.max, [70, 70, 114]);
  assert.equal(bodyBounds.min[1], -70);
  assert.equal(bodyBounds.min[2], 0);
  assert.ok(bodyBounds.min[0] >= -70 && bodyBounds.min[0] <= -67.8);
  assert.deepEqual(model.saucer.boundingBox(), {
    min: [-35, -35, 0],
    max: [35, 35, 4.8],
  });
  assert.ok(Math.abs(model.section.volume() * 2 - model.body.volume()) < 0.001);
});
test("the smaller saucer clears both bodies and supports their flat bases", () => {
  for (const variant of Object.values(variants)) {
    const assembledBody = variant.body.translate([
      0,
      0,
      dimensions.assemblyLift,
    ]);
    const overlap = assembledBody.intersect(variant.saucer);
    assert.ok(
      Math.abs(overlap.volume()) < 0.001,
      "saucer rim does not intersect the sphere",
    );
    const geometry = new STLLoader().parse(
      binarySTL(variant.saucer.getMesh()).buffer,
    );
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    for (let seat = 0; seat < 3; seat++) {
      const angle = (seat * Math.PI * 2) / 3;
      const [hit] = new THREE.Raycaster(
        new THREE.Vector3(Math.cos(angle) * 22, Math.sin(angle) * 22, 20),
        new THREE.Vector3(0, 0, -1),
      ).intersectObject(mesh);
      assert.ok(
        Math.abs(hit.point.z - dimensions.assemblyLift) < 0.001,
        "seat meets the body base",
      );
    }
    geometry.dispose();
    material.dispose();
    overlap.delete();
    assembledBody.delete();
  }
});

test("the cavity opens at the top and drains through the floor", () => {
  const geometry = new STLLoader().parse(
    binarySTL(model.body.getMesh()).buffer,
  );
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  const castDownwardRay = (x: number) =>
    new THREE.Raycaster(
      new THREE.Vector3(x, 0, 150),
      new THREE.Vector3(0, 0, -1),
    ).intersectObject(mesh);
  assert.equal(
    castDownwardRay(0).length,
    0,
    "centerline passes through open mouth and drain",
  );
  const floorIntersections = castDownwardRay(10);
  assert.ok(floorIntersections.length >= 2);
  assert.ok(
    Math.abs(floorIntersections[0].point.z - 6) < 0.001,
    "floor is 6 mm thick",
  );
  geometry.dispose();
  material.dispose();
});
test("exported STL files reproduce both opening variants exactly", async () => {
  for (const opening of openingKinds) {
    for (const [key, file] of [
      ["body", "planter"],
      ["saucer", "saucer"],
      ["section", "section"],
    ] as const) {
      assert.deepEqual(
        await readFile(
          `public${modelAssetPath(opening, `orbital-${file}.stl`)}`,
        ),
        Buffer.from(binarySTL(variants[opening][key].getMesh())),
      );
    }
  }
});

test("each download contains only its matching planter and saucer", async () => {
  for (const opening of openingKinds) {
    const archive = unzipSync(
      await readFile(`public${modelAssetPath(opening, "orbital-planter.zip")}`),
    );
    assert.deepEqual(Object.keys(archive).sort(), [
      "orbital-planter.stl",
      "orbital-saucer.stl",
    ]);
    for (const [filename, contents] of Object.entries(archive)) {
      assert.deepEqual(
        Buffer.from(contents),
        await readFile(`public${modelAssetPath(opening, filename)}`),
      );
    }
  }
});

test("diagonal mouth follows the stripes with a smaller aperture and a flat draining base", () => {
  const geometry = new STLLoader().parse(
    binarySTL(diagonalModel.body.getMesh()).buffer,
  );
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  const normal = new THREE.Vector3(1, 0, 1).normalize();
  const center = new THREE.Vector3(0, 0, 62);
  for (const radius of [0, 21, 24]) {
    const origin = center
      .clone()
      .addScaledVector(normal, 100)
      .add(new THREE.Vector3(0, radius, 0));
    const [hit] = new THREE.Raycaster(
      origin,
      normal.clone().negate(),
    ).intersectObject(mesh);
    assert.ok(hit);
    if (radius < 22)
      assert.ok(hit.distance > 100, "ray enters the diagonal cavity");
    else
      assert.ok(
        Math.abs(hit.distance - 40) < 0.01,
        "rim lies on the 45-degree opening plane",
      );
  }
  const [drainHit] = new THREE.Raycaster(
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0, 1),
  ).intersectObject(mesh);
  assert.ok(drainHit.point.z > 100, "bottom drainage remains open");
  assert.equal(diagonalModel.body.boundingBox().min[2], 0);
  assert.equal(diagonalModel.body.boundingBox().max[2], 132);
  geometry.dispose();
  material.dispose();
});

test("front-facing grooves follow the official logo's positions and widths", () => {
  const geometry = new STLLoader().parse(
    binarySTL(model.body.getMesh()).buffer,
  );
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  const logoGrooveCentersMM = [-10.55105, -31.31179, -52.07246];

  for (const centerMM of logoGrooveCentersMM) {
    for (const offsetMM of [-5.6, -5, 0, 5, 5.6]) {
      const diagonalCoordinate = (centerMM + offsetMM) / Math.SQRT2;
      const ray = new THREE.Raycaster(
        new THREE.Vector3(diagonalCoordinate, -100, 62 + diagonalCoordinate),
        new THREE.Vector3(0, 1, 0),
      );
      const [intersection] = ray.intersectObject(mesh);
      assert.ok(intersection, "groove sample hits the planter surface");
      const radiusMM = intersection.point.distanceTo(
        new THREE.Vector3(0, 0, 62),
      );
      const expectedRadiusMM = Math.abs(offsetMM) <= 5 ? 67.8 : 70;
      assert.ok(
        Math.abs(radiusMM - expectedRadiusMM) < 0.05,
        `groove at ${centerMM} mm has the expected surface at offset ${offsetMM} mm`,
      );
    }
  }

  geometry.dispose();
  material.dispose();
});

afterAll(() => {
  model.dispose();
  diagonalModel.dispose();
});
