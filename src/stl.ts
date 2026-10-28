import type { Mesh, Vec3 } from "manifold-3d";

const STL_HEADER_BYTES = 80;
const TRIANGLE_COUNT_BYTES = 4;
const TRIANGLE_RECORD_BYTES = 50;
const FLOAT_BYTES = 4;

function readVertex(
  mesh: Mesh,
  triangleIndex: number,
  cornerIndex: number,
): Vec3 {
  const vertexIndex = mesh.triVerts[triangleIndex * 3 + cornerIndex];
  const offset = vertexIndex * mesh.numProp;
  return [
    mesh.vertProperties[offset],
    mesh.vertProperties[offset + 1],
    mesh.vertProperties[offset + 2],
  ];
}

function triangleNormal(first: Vec3, second: Vec3, third: Vec3): Vec3 {
  const firstEdge = second.map((coordinate, axis) => coordinate - first[axis]);
  const secondEdge = third.map((coordinate, axis) => coordinate - first[axis]);
  const crossProduct: Vec3 = [
    firstEdge[1] * secondEdge[2] - firstEdge[2] * secondEdge[1],
    firstEdge[2] * secondEdge[0] - firstEdge[0] * secondEdge[2],
    firstEdge[0] * secondEdge[1] - firstEdge[1] * secondEdge[0],
  ];
  const length = Math.hypot(...crossProduct) || 1;
  return [
    crossProduct[0] / length,
    crossProduct[1] / length,
    crossProduct[2] / length,
  ];
}

export function binarySTL(mesh: Mesh) {
  const triangleCount = mesh.triVerts.length / 3;
  const triangleDataOffset = STL_HEADER_BYTES + TRIANGLE_COUNT_BYTES;
  const buffer = new ArrayBuffer(
    triangleDataOffset + triangleCount * TRIANGLE_RECORD_BYTES,
  );
  const data = new DataView(buffer);
  data.setUint32(STL_HEADER_BYTES, triangleCount, true);

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const first = readVertex(mesh, triangleIndex, 0);
    const second = readVertex(mesh, triangleIndex, 1);
    const third = readVertex(mesh, triangleIndex, 2);
    const normal = triangleNormal(first, second, third);
    const recordOffset =
      triangleDataOffset + triangleIndex * TRIANGLE_RECORD_BYTES;
    const coordinates = [...normal, ...first, ...second, ...third];

    coordinates.forEach((coordinate, index) => {
      data.setFloat32(recordOffset + index * FLOAT_BYTES, coordinate, true);
    });
  }

  return new Uint8Array(buffer);
}
