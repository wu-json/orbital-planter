import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const placeKinds = [
  "studio",
  "white",
  "wood",
  "loft",
  "night",
  "creative",
] as const;
export type PlaceKind = (typeof placeKinds)[number];
type OfficeKind = Exclude<PlaceKind, "studio">;
type SurfaceTexture = "wood" | "brick" | "concrete";

interface OfficeStyle {
  name: string;
  description: string;
  wall: string;
  floor: string;
  desk: string;
  frame: string;
  accent: string;
  sky: string;
  background: string;
  light: string;
  texture?: SurfaceTexture;
  theme: "light" | "dark";
  exposure: number;
}

export const officeStyles: Record<OfficeKind, OfficeStyle> = {
  white: {
    name: "White office",
    description: "San Francisco · glass & daylight",
    wall: "#e8ecec",
    floor: "#d6dcde",
    desk: "#f3f3f0",
    frame: "#c4cdd0",
    accent: "#bbcbd1",
    sky: "#c7e1ed",
    background: "#dce6eb",
    light: "#f2f8ff",
    theme: "light",
    exposure: 1.1,
  },
  wood: {
    name: "Warm studio",
    description: "Oak, books & afternoon light",
    wall: "#d6c7af",
    floor: "#a59a87",
    desk: "#a2784f",
    frame: "#3b3932",
    accent: "#ab7950",
    sky: "#eedfc1",
    background: "#d4c8b6",
    light: "#ffe3bc",
    texture: "wood",
    theme: "light",
    exposure: 1.05,
  },
  loft: {
    name: "Industrial loft",
    description: "Brick, steel & concrete",
    wall: "#9e6251",
    floor: "#858582",
    desk: "#a1a39f",
    frame: "#262b2c",
    accent: "#a6754c",
    sky: "#c1d2d5",
    background: "#a6b3b7",
    light: "#e4eff5",
    texture: "concrete",
    theme: "light",
    exposure: 1.05,
  },
  night: {
    name: "Night shift",
    description: "City lights & a neon glow",
    wall: "#20222e",
    floor: "#22232b",
    desk: "#292b36",
    frame: "#13151d",
    accent: "#8f64ff",
    sky: "#17203d",
    background: "#10131f",
    light: "#bdcaff",
    theme: "dark",
    exposure: 1.1,
  },
  creative: {
    name: "Creative studio",
    description: "Peach walls & playful color",
    wall: "#e6bca8",
    floor: "#cabeb0",
    desk: "#c7bed8",
    frame: "#5c817b",
    accent: "#e78650",
    sky: "#c8dce2",
    background: "#d9c6be",
    light: "#ffebd8",
    theme: "light",
    exposure: 1.1,
  },
};

export interface PlacePreview {
  group: THREE.Group;
  supportSurfaceZ: number;
  dispose(): void;
}

function createSurfaceTexture(kind: SurfaceTexture, base: string) {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const baseColor = new THREE.Color(base).convertLinearToSRGB();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const noise = ((x * 73 + y * 113 + x * y * 31) % 101) / 100;
      let shade = 0.88 + noise * 0.16;
      if (kind === "wood")
        shade *=
          0.85 +
          Math.sin(y * 1.3 + Math.sin(x * 0.05) * 2) * 0.08 +
          Math.sin(y * 0.32) * 0.08;
      if (kind === "brick") {
        const row = Math.floor(y / 24);
        const mortar = y % 24 < 2 || (x + (row % 2) * 31) % 64 < 2;
        shade = mortar
          ? 0.48
          : 0.8 +
            ((Math.floor((x + (row % 2) * 31) / 64) + row * 7) % 5) * 0.05 +
            noise * 0.1;
      }
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.min(255, baseColor.r * shade * 255);
      pixels[offset + 1] = Math.min(255, baseColor.g * shade * 255);
      pixels[offset + 2] = Math.min(255, baseColor.b * shade * 255);
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "brick" ? 7 : 3, kind === "brick" ? 4 : 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createMonitorTexture(night: boolean) {
  const width = 640;
  const height = 384;
  const pixels = new Uint8Array(width * height * 4);

  function fillRectangle(
    x: number,
    y: number,
    rectangleWidth: number,
    rectangleHeight: number,
    color: string,
  ) {
    const rgb = new THREE.Color(color).convertLinearToSRGB();
    for (let row = y; row < y + rectangleHeight; row++) {
      for (let column = x; column < x + rectangleWidth; column++) {
        const offset = ((height - row - 1) * width + column) * 4;
        pixels[offset] = Math.round(rgb.r * 255);
        pixels[offset + 1] = Math.round(rgb.g * 255);
        pixels[offset + 2] = Math.round(rgb.b * 255);
        pixels[offset + 3] = 255;
      }
    }
  }

  const muted = night ? "#5e5292" : "#465864";
  const accent = night ? "#76d5e0" : "#91a8b1";
  fillRectangle(0, 0, width, height, night ? "#16253c" : "#24313c");
  fillRectangle(24, 20, 100, 344, muted);
  for (let row = 0; row < 7; row++) {
    fillRectangle(
      224 + (row % 2) * 12,
      58 + row * 39,
      175 + (row % 3) * 44,
      8,
      row % 3 === 0 ? accent : muted,
    );
  }

  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function createPlacePreview(kind: PlaceKind): PlacePreview {
  const group = new THREE.Group();
  group.name = `place-${kind}`;
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  function material(
    color: string,
    roughness = 0.7,
    textureKind?: SurfaceTexture,
  ) {
    const map = textureKind ? createSurfaceTexture(textureKind, color) : null;
    if (map) textures.add(map);
    const surface = new THREE.MeshStandardMaterial({
      color: map ? "#ffffff" : color,
      roughness,
      map,
    });
    materials.add(surface);
    return surface;
  }

  function addMesh(
    name: string,
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    position: THREE.Vector3Tuple,
  ) {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function box(
    name: string,
    size: THREE.Vector3Tuple,
    position: THREE.Vector3Tuple,
    surface: THREE.Material,
    radius = 0,
  ) {
    const geometry =
      radius > 0
        ? new RoundedBoxGeometry(...size, 2, radius)
        : new THREE.BoxGeometry(...size);
    return addMesh(name, geometry, surface, position);
  }

  function cylinder(
    name: string,
    radius: number,
    height: number,
    position: THREE.Vector3Tuple,
    surface: THREE.Material,
  ) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
    geometry.rotateX(Math.PI / 2);
    return addMesh(name, geometry, surface, position);
  }

  function tube(
    name: string,
    points: THREE.Vector3Tuple[],
    radius: number,
    surface: THREE.Material,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((point) => new THREE.Vector3(...point)),
    );
    return addMesh(
      name,
      new THREE.TubeGeometry(curve, 32, radius, 8, false),
      surface,
      [0, 0, 0],
    );
  }

  function emissive(color: string, intensity = 0.6) {
    const surface = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.5,
    });
    materials.add(surface);
    return surface;
  }

  function addWindow(style: OfficeStyle) {
    const frame = material(style.frame);
    box(
      "window",
      [1650, 10, 1150],
      [180, 1180, 420],
      emissive(style.sky, kind === "night" ? 0.2 : 0.55),
    );
    const skyline = material(kind === "night" ? "#0e1527" : "#adc2ca");
    for (let index = 0; index < 12; index++) {
      const height = 100 + ((index * 71) % 330);
      const x = -550 + index * 128;
      box(
        "skyline",
        [83 + (index % 3) * 14, 5, height],
        [x, 1168, -150 + height / 2],
        skyline,
      );
      if (kind === "night") {
        const windowLight = emissive(index % 2 ? "#e8c17c" : "#84afbd", 0.8);
        for (let row = 0; row < Math.floor(height / 45); row++) {
          for (let column = 0; column < 3; column++) {
            if ((row + column + index) % 3 === 0) continue;
            box(
              "city-light",
              [8, 3, 13],
              [x - 24 + column * 23, 1163, -130 + row * 44],
              windowLight,
            );
          }
        }
      }
    }
    for (const x of [-645, -95, 455, 1005])
      box("window-mullion", [12, 24, 1170], [x, 1155, 420], frame);
    for (const z of [-160, 420, 1000])
      box("window-mullion", [1660, 24, 12], [180, 1155, z], frame);
    box("window-sill", [1710, 110, 26], [180, 1130, -165], frame, 3);
  }

  function addMonitor(style: OfficeStyle) {
    const shell = material(kind === "white" ? "#d6dcde" : "#303238", 0.4);
    const dark = material("#14191d", 0.5);
    box("monitor-base", [190, 120, 12], [-400, 170, 6], shell, 5);
    box("monitor-stand", [42, 30, 120], [-400, 190, 66], shell, 5);
    box("monitor", [430, 18, 265], [-400, 190, 245], shell, 8);
    const screenTexture = createMonitorTexture(kind === "night");
    textures.add(screenTexture);
    const screenMaterial = new THREE.MeshBasicMaterial({
      map: screenTexture,
      toneMapped: false,
    });
    materials.add(screenMaterial);
    const screenGeometry = new THREE.PlaneGeometry(406, 236);
    screenGeometry.rotateX(Math.PI / 2);
    const screen = addMesh(
      "display",
      screenGeometry,
      screenMaterial,
      [-400, 179, 247],
    );
    screen.castShadow = false;
    screen.receiveShadow = false;
    box("keyboard", [338, 114, 9], [-410, -65, 5], shell, 5);
    const keys = material(kind === "white" ? "#e7e9e9" : "#4c5056");
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 13; column++)
        box(
          "key",
          [19, 17, 3],
          [-555 + column * 24, -102 + row * 23, 11],
          keys,
          2,
        );
    }
    box("spacebar", [119, 17, 3], [-420, -10, 11], keys, 2);
    box("mouse", [36, 62, 22], [-196, -65, 12], shell, 10);
    if (kind === "night")
      box(
        "keyboard-glow",
        [330, 2, 3],
        [-410, -123, 8],
        emissive("#7e65ee", 2),
      );
    cylinder("monitor-indicator", 1.4, 1, [-400, 179, 122], dark);
  }

  function addMug(style: OfficeStyle) {
    const ceramic = material(
      kind === "creative"
        ? "#d9774d"
        : kind === "night"
          ? "#44445c"
          : "#e3d9ca",
      0.4,
    );
    ceramic.side = THREE.DoubleSide;
    const wall = new THREE.CylinderGeometry(31, 28, 75, 40, 1, true);
    wall.rotateX(Math.PI / 2);
    addMesh("mug", wall, ceramic, [250, 110, 39]);
    addMesh(
      "mug-rim",
      new THREE.TorusGeometry(31, 2, 8, 40),
      ceramic,
      [250, 110, 76.5],
    );
    const handle = new THREE.TorusGeometry(21, 4, 8, 32);
    handle.rotateX(Math.PI / 2);
    addMesh("mug-handle", handle, ceramic, [280, 110, 40]);
    cylinder("coffee", 29, 1, [250, 110, 68], material("#32251e", 0.3));
  }

  function addLamp(style: OfficeStyle) {
    const metal = material(style.frame, 0.4);
    cylinder("lamp-base", 42, 9, [270, 330, 5], metal);
    if (kind === "creative") {
      cylinder("lamp-stem", 7, 100, [270, 330, 59], metal);
      addMesh(
        "orb-lamp",
        new THREE.SphereGeometry(52, 32, 20),
        emissive(style.accent, 0.4),
        [270, 330, 140],
      );
    } else {
      tube(
        "lamp-arm",
        [
          [270, 330, 9],
          [270, 330, 200],
          [255, 310, 280],
          [220, 270, 290],
        ],
        5,
        metal,
      );
      const shade = new THREE.SphereGeometry(
        42,
        32,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      shade.rotateX(Math.PI / 2);
      addMesh("lamp-shade", shade, metal, [220, 270, 280]);
      cylinder(
        "lamp-diffuser",
        38,
        2,
        [220, 270, 280],
        emissive("#ffe1aa", 0.9),
      );
    }
  }

  function addBooks(style: OfficeStyle) {
    const paper = material("#e4ddcf");
    const cover = material(style.accent);
    box("notebook", [128, 172, 15], [260, -115, 8], cover, 3);
    box("notebook-pages", [122, 164, 10], [261, -115, 8], paper, 2);
    box("notebook-cover", [128, 172, 2], [260, -115, 16], cover, 2);
    const pen = cylinder(
      "pen",
      2.5,
      122,
      [245, -110, 20],
      material(style.frame),
    );
    pen.rotation.x = Math.PI / 2;
    pen.rotation.z = -0.2;
  }

  function addChair(style: OfficeStyle) {
    const fabric = material(
      kind === "creative" ? "#d17c5c" : style.accent,
      0.95,
    );
    const metal = material(style.frame, 0.45);
    box("chair-seat", [400, 370, 50], [-450, 650, -280], fabric, 24);
    box("chair-back", [390, 42, 420], [-450, 820, -80], fabric, 20);
    cylinder("chair-post", 18, 365, [-450, 650, -485], metal);
    for (let leg = 0; leg < 5; leg++) {
      const angle = (leg * Math.PI * 2) / 5;
      tube(
        "chair-foot",
        [
          [-450, 650, -665],
          [-450 + Math.cos(angle) * 110, 650 + Math.sin(angle) * 110, -690],
          [-450 + Math.cos(angle) * 220, 650 + Math.sin(angle) * 220, -708],
        ],
        10,
        metal,
      );
      addMesh("chair-caster", new THREE.SphereGeometry(20, 12, 8), metal, [
        -450 + Math.cos(angle) * 220,
        650 + Math.sin(angle) * 220,
        -720,
      ]);
    }
  }

  function addShelves(style: OfficeStyle) {
    const shelf = material(style.frame);
    const colors = ["#526561", "#c5ae85", "#796d7b", "#b78064", "#d2c7b4"];
    for (let row = 0; row < 3; row++) {
      const z = 40 + row * 240;
      box("shelf", [470, 170, 18], [1000, 1010, z], shelf, 2);
      for (let book = 0; book < 8; book++) {
        const height = 100 + ((book * 23) % 75);
        box(
          "book",
          [24 + (book % 3) * 4, 105, height],
          [820 + book * 38, 1020, z + 9 + height / 2],
          material(colors[(book + row) % colors.length]),
          1,
        );
      }
    }
  }

  function addCreativeArt() {
    const frame = material("#e8d9c9");
    box("art-frame", [390, 18, 490], [-1000, 1174, 470], frame, 4);
    box("art-paper", [360, 3, 460], [-1000, 1163, 470], material("#e5c887"));
    const circle = new THREE.CircleGeometry(110, 48);
    circle.rotateX(Math.PI / 2);
    addMesh("art-circle", circle, material("#9f6989"), [-1000, 1160, 540]);
    box("art-block", [200, 2, 90], [-960, 1158, 350], material("#48766f"), 3);
  }

  function addLighting(style: OfficeStyle) {
    const ambient = new THREE.HemisphereLight(
      style.light,
      style.floor,
      kind === "night" ? 0.8 : 1.7,
    );
    ambient.up.set(0, 0, 1);
    ambient.position.set(0, 0, 1000);
    const key = new THREE.DirectionalLight(
      style.light,
      kind === "night" ? 1.8 : 2.6,
    );
    key.position.set(-500, -380, 1000);
    key.target.position.set(0, 0, 100);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -850,
      right: 850,
      top: 850,
      bottom: -850,
      near: 10,
      far: 2400,
    });
    key.shadow.normalBias = 0.3;
    key.shadow.bias = -0.00015;
    const fill = new THREE.DirectionalLight(
      kind === "night" ? "#8c73dd" : "#ffffff",
      kind === "night" ? 1.4 : 0.8,
    );
    fill.position.set(700, 900, 700);
    group.add(ambient, key, key.target, fill);
    if (kind === "night") {
      const purple = new THREE.PointLight("#a080ff", 2.3, 1600, 0);
      purple.position.set(330, 500, 360);
      const cyan = new THREE.PointLight("#66ccdd", 1.5, 1500, 0);
      cyan.position.set(-550, 250, 300);
      group.add(purple, cyan);
      box(
        "neon-upright",
        [12, 15, 1050],
        [1070, 1170, 410],
        emissive("#ad6eff", 4),
      );
      box(
        "neon-horizontal",
        [1650, 15, 8],
        [180, 1170, 1030],
        emissive("#59becd", 3),
      );
    }
  }

  if (kind !== "studio") {
    const style = officeStyles[kind];
    box(
      "room-floor",
      [4800, 4200, 20],
      [0, 300, -750],
      material(style.floor, 0.95, kind === "loft" ? "concrete" : undefined),
    );
    box(
      "back-wall",
      [4400, 25, 2400],
      [0, 1200, 460],
      material(style.wall, 0.95, kind === "loft" ? "brick" : undefined),
    );
    box(
      "side-wall",
      [25, 3400, 2400],
      [-1800, -480, 460],
      material(kind === "creative" ? "#8eaaa2" : style.wall),
    );
    const deskSurface = material(
      style.desk,
      kind === "white" ? 0.4 : 0.72,
      style.texture,
    );
    box("desktop", [1350, 680, 26], [-250, 100, -13], deskSurface, 8);
    const deskFrame = material(style.frame, 0.5);
    for (const x of [-840, 340]) {
      for (const y of [-170, 370])
        box("desk-leg", [36, 36, 714], [x, y, -383], deskFrame, 4);
    }
    box("desk-rail", [1220, 26, 55], [-250, 345, -65], deskFrame, 3);
    addWindow(style);
    addMonitor(style);
    addMug(style);
    addLamp(style);
    addBooks(style);
    addChair(style);
    if (kind === "wood" || kind === "loft") addShelves(style);
    if (kind === "creative") addCreativeArt();
    if (kind === "wood") {
      const wood = material("#b48f65", 0.8, "wood");
      for (let slat = 0; slat < 11; slat++)
        box(
          "wall-slat",
          [22, 35, 1700],
          [-1400 + slat * 44, 1170, 250],
          wood,
          2,
        );
    }
    addLighting(style);
  }

  return {
    group,
    supportSurfaceZ: 0,
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) geometries.add(object.geometry);
        if (
          object instanceof THREE.DirectionalLight ||
          object instanceof THREE.PointLight
        )
          object.shadow.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((surface) => surface.dispose());
      textures.forEach((texture) => texture.dispose());
      group.removeFromParent();
    },
  };
}
