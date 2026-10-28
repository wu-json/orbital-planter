import { test, afterAll } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Module from "manifold-3d";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { createModel } from "../src/model.ts";
import { binarySTL } from "../src/stl.ts";
import { unzipSync } from "fflate";
const kernel = await Module();
kernel.setup();
const model = createModel(kernel);

test("printable parts are closed, connected solids with positive volume", () => {
  for (const name of ["body", "saucer"] as const) {
    const part = model[name];
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
    min: [-44, -44, 0],
    max: [44, 44, 10],
  });
  assert.ok(Math.abs(model.section.volume() * 2 - model.body.volume()) < 0.001);
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
test("committed STL exports reproduce the CAD geometry exactly", async () => {
  for (const [key, file] of [
    ["body", "planter"],
    ["saucer", "saucer"],
    ["section", "section"],
  ] as const) {
    const expected = Buffer.from(binarySTL(model[key].getMesh()));
    assert.deepEqual(
      await readFile(`public/models/orbital-${file}.stl`),
      expected,
    );
  }
});
test("download archive contains exactly the two printable STL files", async () => {
  const archive = unzipSync(
    await readFile("public/models/orbital-planter.zip"),
  );
  assert.deepEqual(Object.keys(archive).sort(), [
    "orbital-planter.stl",
    "orbital-saucer.stl",
  ]);
  for (const [filename, contents] of Object.entries(archive)) {
    assert.deepEqual(
      Buffer.from(contents),
      await readFile(`public/models/${filename}`),
    );
  }
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

afterAll(() => model.dispose());
