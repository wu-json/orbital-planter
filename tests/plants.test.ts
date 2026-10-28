import { test } from "bun:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPlantPreview, plantKinds, soilHeightMM } from "../src/plants.ts";
import { dimensions } from "../src/model.ts";

test("empty preview adds neither foliage nor soil", () => {
  const preview = createPlantPreview("empty");
  assert.equal(preview.group.children.length, 0);
  preview.dispose();
});

test("plant meshes contain finite vertices and stay clear of the planter walls", () => {
  for (const kind of plantKinds.filter((kind) => kind !== "empty")) {
    const preview = createPlantPreview(kind);
    preview.group.position.z = soilHeightMM;
    preview.group.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    let leaves = 0;
    preview.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index++) {
        point
          .fromBufferAttribute(positions, index)
          .applyMatrix4(object.matrixWorld);
        assert.ok(
          Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            Number.isFinite(point.z),
        );
        if (
          !object.name.endsWith("-leaf") ||
          point.z < 0 ||
          point.z > dimensions.height
        )
          continue;
        const sphereRadius = Math.hypot(point.x, point.y, point.z - 62);
        assert.ok(
          sphereRadius < 64.3 || sphereRadius > 69.7,
          `${kind} foliage intersects the planter wall at ${point.toArray().map((value) => value.toFixed(1))}`,
        );
      }
      if (object.name.endsWith("-leaf")) leaves++;
    });
    assert.ok(
      kind === "asparagus" || leaves >= 6,
      `${kind} has a complete canopy`,
    );
    preview.dispose();
  }
});

test("plant options have distinct silhouettes and remain above the ground", () => {
  const sizes = new Map<string, THREE.Vector3>();
  for (const kind of plantKinds.filter((kind) => kind !== "empty")) {
    const preview = createPlantPreview(kind);
    preview.group.position.z = soilHeightMM + dimensions.assemblyLift;
    const bounds = new THREE.Box3().setFromObject(preview.group);
    assert.ok(bounds.min.z >= 0, `${kind} clears the ground`);
    sizes.set(kind, bounds.getSize(new THREE.Vector3()));
    preview.dispose();
  }
  assert.ok(sizes.get("snake")!.z > sizes.get("snake")!.x * 1.4);
  assert.ok(sizes.get("pothos")!.x > sizes.get("snake")!.x * 1.4);
  assert.ok(sizes.get("succulent")!.z < sizes.get("monstera")!.z / 2);
});

test("replacing a preview detaches it and releases shared geometry once", () => {
  const scene = new THREE.Scene();
  const preview = createPlantPreview("pothos");
  scene.add(preview.group);
  const geometryDisposals = new Map<THREE.BufferGeometry, number>();
  preview.group.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      geometryDisposals.has(object.geometry)
    )
      return;
    geometryDisposals.set(object.geometry, 0);
    object.geometry.addEventListener("dispose", () =>
      geometryDisposals.set(
        object.geometry,
        geometryDisposals.get(object.geometry)! + 1,
      ),
    );
  });
  preview.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok([...geometryDisposals.values()].every((count) => count === 1));
});
