import { mkdir, writeFile } from "node:fs/promises";
import { zipSync } from "fflate";
import Module, { type Box } from "manifold-3d";
import { createModel, dimensions, grooveLayout } from "../src/model.ts";
import { binarySTL } from "../src/stl.ts";

type PartName = "body" | "saucer" | "section";

interface PartReport {
  triangles: number;
  volumeMM3: number;
  bounds: Box;
}

const modelExports = [
  { part: "body", filename: "orbital-planter.stl", printable: true },
  { part: "saucer", filename: "orbital-saucer.stl", printable: true },
  { part: "section", filename: "orbital-section.stl", printable: false },
] as const;

const kernel = await Module();
kernel.setup();
const model = createModel(kernel);

try {
  await mkdir("public/models", { recursive: true });
  const parts: Partial<Record<PartName, PartReport>> = {};
  const printableFiles: Record<string, Uint8Array> = {};

  for (const { part: partName, filename, printable } of modelExports) {
    const part = model[partName];
    const status = part.status();
    if (status !== "NoError") throw new Error(`${filename}: ${status}`);

    const mesh = part.getMesh();
    const stl = binarySTL(mesh);
    await writeFile(`public/models/${filename}`, stl);
    if (printable) printableFiles[filename] = stl;
    parts[partName] = {
      triangles: mesh.triVerts.length / 3,
      volumeMM3: part.volume(),
      bounds: part.boundingBox(),
    };
  }

  const printableArchive = zipSync(printableFiles, {
    mtime: new Date(2026, 0, 1),
    level: 6,
  });
  await writeFile("public/models/orbital-planter.zip", printableArchive);

  const specification = JSON.stringify(
    { dimensions, grooves: grooveLayout, units: "mm", parts },
    null,
    2,
  );
  await writeFile("public/models/specification.json", specification);
  console.log(specification);
} finally {
  model.dispose();
}
