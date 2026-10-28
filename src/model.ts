import type { Manifold, ManifoldToplevel, Vec3 } from "manifold-3d";

export const dimensions = Object.freeze({
  diameter: 140,
  height: 114,
  wall: 6,
  grooveDepth: 2.2,
  grooveCount: 3,
  drainDiameter: 8,
  saucerDiameter: 88,
  assemblyLift: 6,
});

const linearLogoDiagonalGaps = [
  [5.4153, 15.90104],
  [26.38682, 36.87255],
  [47.35823665, 57.84401],
] as const;

const logoCoordinateToPlaneDistance = dimensions.diameter / (100 * Math.SQRT2);

export const grooveLayout = Object.freeze({
  reference:
    "https://static.linear.app/design-assets/Linear-Brand-Assets.zip?v=3",
  angleDegrees: 45,
  bands: linearLogoDiagonalGaps.map(([start, end]) => ({
    offsetMM: -((start + end) / 2) * logoCoordinateToPlaneDistance,
    widthMM: (end - start) * logoCoordinateToPlaneDistance,
  })),
});

const bodyProfile = {
  centerHeightMM: 62,
  floorThicknessMM: 6,
  grooveCutterWidthMM: 180,
  grooveCutterMarginMM: 2,
};

const saucerProfile = {
  heightMM: 10,
  innerRadiusMM: 40,
  floorThicknessMM: 3,
  seatCount: 3,
  seatHeightMM: 3,
  seatRadiusMM: 6,
  seatDistanceFromCenterMM: 22,
};

export function createModel(kernel: ManifoldToplevel, circularSegments = 192) {
  const { Manifold } = kernel;
  const allocatedSolids: Manifold[] = [];

  function trackSolid(solid: Manifold) {
    allocatedSolids.push(solid);
    return solid;
  }

  const sphere = (radiusMM: number) =>
    trackSolid(Manifold.sphere(radiusMM, circularSegments));
  const cylinder = (heightMM: number, radiusMM: number) =>
    trackSolid(
      Manifold.cylinder(heightMM, radiusMM, radiusMM, circularSegments),
    );
  const translate = (solid: Manifold, offsetMM: Vec3) =>
    trackSolid(solid.translate(offsetMM));
  const subtract = (solid: Manifold, cutter: Manifold) =>
    trackSolid(solid.subtract(cutter));
  const intersect = (first: Manifold, second: Manifold) =>
    trackSolid(first.intersect(second));
  const trimAboveZ = (solid: Manifold, heightMM: number) =>
    trackSolid(solid.trimByPlane([0, 0, -1], -heightMM));
  const trimBelowZ = (solid: Manifold, heightMM: number) =>
    trackSolid(solid.trimByPlane([0, 0, 1], heightMM));

  function createGroovedSphere() {
    const outerRadiusMM = dimensions.diameter / 2;
    let groovedSphere = sphere(outerRadiusMM);
    const removableOuterSkin = subtract(
      sphere(outerRadiusMM + bodyProfile.grooveCutterMarginMM),
      sphere(outerRadiusMM - dimensions.grooveDepth),
    );

    for (const { offsetMM, widthMM } of grooveLayout.bands) {
      const grooveSlab = trackSolid(
        Manifold.cube(
          [
            bodyProfile.grooveCutterWidthMM,
            bodyProfile.grooveCutterWidthMM,
            widthMM,
          ],
          true,
        ),
      );
      const offsetSlab = translate(grooveSlab, [0, 0, offsetMM]);
      const diagonalSlab = trackSolid(
        offsetSlab.rotate([0, grooveLayout.angleDegrees, 0]),
      );
      const shallowGroove = intersect(removableOuterSkin, diagonalSlab);
      groovedSphere = subtract(groovedSphere, shallowGroove);
    }

    return groovedSphere;
  }

  function createPlanterBody() {
    const sphereCenterMM: Vec3 = [0, 0, bodyProfile.centerHeightMM];
    const outerSphere = translate(createGroovedSphere(), sphereCenterMM);
    const flatBottom = trimBelowZ(outerSphere, 0);
    const openTop = trimAboveZ(flatBottom, dimensions.height);
    const innerRadiusMM = dimensions.diameter / 2 - dimensions.wall;
    const innerSphere = translate(sphere(innerRadiusMM), sphereCenterMM);
    const plantingCavity = trimBelowZ(
      innerSphere,
      bodyProfile.floorThicknessMM,
    );
    const hollowBody = subtract(openTop, plantingCavity);
    const drainCutter = translate(
      cylinder(16, dimensions.drainDiameter / 2),
      [0, 0, -1],
    );
    return subtract(hollowBody, drainCutter);
  }

  function createSaucerWithDrainageSeats() {
    const outerTray = cylinder(
      saucerProfile.heightMM,
      dimensions.saucerDiameter / 2,
    );
    const trayCavity = translate(cylinder(12, saucerProfile.innerRadiusMM), [
      0,
      0,
      saucerProfile.floorThicknessMM,
    ]);
    let saucer = subtract(outerTray, trayCavity);

    for (let seatIndex = 0; seatIndex < saucerProfile.seatCount; seatIndex++) {
      const angleRadians = (seatIndex * Math.PI * 2) / saucerProfile.seatCount;
      const drainageSeat = translate(
        cylinder(saucerProfile.seatHeightMM, saucerProfile.seatRadiusMM),
        [
          saucerProfile.seatDistanceFromCenterMM * Math.cos(angleRadians),
          saucerProfile.seatDistanceFromCenterMM * Math.sin(angleRadians),
          saucerProfile.floorThicknessMM,
        ],
      );
      saucer = trackSolid(saucer.add(drainageSeat));
    }

    return saucer;
  }

  const body = createPlanterBody();
  const saucer = createSaucerWithDrainageSeats();
  const section = trackSolid(body.trimByPlane([0, 1, 0], 0));

  return {
    body,
    saucer,
    section,
    dispose() {
      while (allocatedSolids.length > 0) allocatedSolids.pop()?.delete();
    },
  };
}
