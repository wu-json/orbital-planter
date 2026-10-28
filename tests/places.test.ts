import { test } from "bun:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPlacePreview, placeKinds } from "../src/places.ts";

test("studio leaves the existing object preview unobstructed", () => {
  const preview = createPlacePreview("studio");
  assert.equal(preview.group.children.length, 0);
  preview.dispose();
});

test("office desktops support the planter without props intersecting it", () => {
  const planterSpace = new THREE.Box3(
    new THREE.Vector3(-70, -70, 0.1),
    new THREE.Vector3(70, 70, 120),
  );
  for (const kind of placeKinds.filter((kind) => kind !== "studio")) {
    const preview = createPlacePreview(kind);
    preview.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 500),
      new THREE.Vector3(0, 0, -1),
    );
    const hits = ray.intersectObject(preview.group);
    assert.ok(hits.length > 0);
    assert.equal(hits[0].object.name, "desktop", kind);
    assert.ok(Math.abs(hits[0].point.z) < 0.001, kind);
    preview.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      assert.ok(
        !new THREE.Box3().setFromObject(object).intersectsBox(planterSpace),
        `${kind}: ${object.name} clears the planter`,
      );
      const positions = object.geometry.getAttribute("position");
      assert.ok(
        Array.from(positions.array).every(Number.isFinite),
        `${kind}: ${object.name} has finite vertices`,
      );
    });
    preview.dispose();
  }
});

test("switching places releases geometry, materials, textures, and shadow maps", () => {
  for (const kind of placeKinds.filter((kind) => kind !== "studio")) {
    const scene = new THREE.Scene();
    const preview = createPlacePreview(kind);
    scene.add(preview.group);
    const resources = new Set<
      THREE.BufferGeometry | THREE.Material | THREE.Texture
    >();
    const shadowMaps: THREE.WebGLRenderTarget[] = [];
    preview.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        resources.add(object.geometry);
        const surfaces = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const surface of surfaces) {
          resources.add(surface);
          if (
            (surface instanceof THREE.MeshStandardMaterial ||
              surface instanceof THREE.MeshBasicMaterial) &&
            surface.map
          )
            resources.add(surface.map);
        }
      }
      if (object instanceof THREE.DirectionalLight && object.castShadow) {
        object.shadow.map = new THREE.WebGLRenderTarget(8, 8);
        shadowMaps.push(object.shadow.map);
      }
    });
    const disposalCounts = new Map<object, number>();
    for (const resource of [...resources, ...shadowMaps]) {
      disposalCounts.set(resource, 0);
      resource.addEventListener("dispose", () =>
        disposalCounts.set(resource, disposalCounts.get(resource)! + 1),
      );
    }
    preview.dispose();
    assert.equal(scene.children.length, 0);
    assert.ok(
      [...disposalCounts.values()].every((count) => count === 1),
      kind,
    );
  }
});
