import * as THREE from 'three';

/* ── Palette ─────────────────────────────────────────────────────────── */
const COL = {
  nightSky: 0x080c14,
  fog: 0x0a1018,
  grass: 0x1a2a1e,
  grassMid: 0x15241a,
  grassDark: 0x0e1812,
  path: 0x3a342c,
  pathLight: 0x4a443c,
  stone: 0x4a4640,
  stoneLight: 0x6a6560,
  stoneDark: 0x35322e,
  mortar: 0x5a5650,
  wood: 0x4a3020,
  woodDark: 0x2a1a10,
  woodLight: 0x6b4a32,
  woodMid: 0x5a3a28,
  plaster: 0xc4b8a0,
  plasterDark: 0x8a7e68,
  plasterWarm: 0xd0c4a8,
  roof: 0x3a2a22,
  roofTile: 0x4a3228,
  roofDark: 0x2a1c16,
  bookSpine: [
    0x6b3a2a, 0x2a3a5a, 0x3a4a2a, 0x5a3a4a, 0x4a3a2a, 0x2a4a4a,
    0x7a4a2a, 0x1a2a4a, 0x4a2a3a, 0x3a5a3a, 0x5a4a2a, 0x2a3a3a,
  ],
  lamp: 0xffcc88,
  candle: 0xffaa55,
  windowGlow: 0xffd9a0,
  snow: 0xe8eef5,
  brass: 0xc9a84c,
  ceramic: 0x3a4a3a,
  ceramicLight: 0xc8b8a0,
  paper: 0xe8e0d0,
  ink: 0x1a1a1a,
  cushion: 0x5a3a2a,
  cushionAlt: 0x4a2a3a,
  rugBase: 0x5a2a22,
  rugBorder: 0x3a1a14,
  rugPattern: 0x7a4a32,
  scroll: 0xe8dcc0,
  scrollInk: 0x2a2a2a,
  city: 0x141820,
  cityMid: 0x1a1e28,
  cityDark: 0x0e1218,
};

/* ── Seeded pseudo-random (stable layout) ────────────────────────────── */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Material / mesh helpers ─────────────────────────────────────────── */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: opts.flatShading ?? false,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

function mesh(geo, material, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function box(w, h, d, color, opts = {}) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
}

function cyl(rTop, rBot, h, color, opts = {}, segs = 16) {
  return mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat(color, opts));
}

function sphere(r, color, opts = {}, wSeg = 16, hSeg = 12) {
  return mesh(new THREE.SphereGeometry(r, wSeg, hSeg), mat(color, opts));
}

/**
 * Build the full world: exterior outskirts + philosopher study.
 * Returns { root, house, anchors, lights, setSnowMode, setNightPhase, update }
 */
export function createWorld(scene) {
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const anchors = {
    houseDoor: new THREE.Vector3(0, 1.2, 6.2),
    studyCenter: new THREE.Vector3(0, 1.4, -1.2),
    philosopherSeat: new THREE.Vector3(-1.15, 0, -1.6),
    youthSeat: new THREE.Vector3(1.15, 0, -0.9),
    exteriorView: new THREE.Vector3(8, 3.5, 14),
    snowView: new THREE.Vector3(2, 2.2, 10),
    doorView: new THREE.Vector3(0, 1.8, 9),
  };

  const rng = mulberry32(20260803);

  // ——— Atmosphere ———
  scene.background = new THREE.Color(COL.nightSky);
  scene.fog = new THREE.FogExp2(COL.fog, 0.012);

  // ——— Rolling multi-ring ground ———
  const groundGroup = new THREE.Group();
  root.add(groundGroup);

  const groundRings = [
    { r: 28, segs: 64, color: COL.grass, y: 0 },
    { r: 52, segs: 56, color: COL.grassMid, y: -0.04 },
    { r: 80, segs: 48, color: COL.grassDark, y: -0.08 },
  ];
  for (const ring of groundRings) {
    const g = mesh(
      new THREE.CircleGeometry(ring.r, ring.segs),
      mat(ring.color, { roughness: 1 }),
      false,
      true
    );
    g.rotation.x = -Math.PI / 2;
    g.position.y = ring.y;
    groundGroup.add(g);
  }

  // Subtle terrain undulations (low flat discs)
  for (let i = 0; i < 18; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = 12 + rng() * 40;
    const r = 2.5 + rng() * 5;
    const mound = mesh(
      new THREE.CircleGeometry(r, 20),
      mat(rng() > 0.5 ? COL.grassMid : COL.grassDark, { roughness: 1 }),
      false,
      true
    );
    mound.rotation.x = -Math.PI / 2;
    mound.position.set(Math.cos(ang) * dist, 0.015 + rng() * 0.02, Math.sin(ang) * dist + 6);
    groundGroup.add(mound);
  }

  // ——— Stone path with irregular flagstones ———
  const pathBase = mesh(
    new THREE.PlaneGeometry(2.6, 24),
    mat(COL.path, { roughness: 0.96 }),
    false,
    true
  );
  pathBase.rotation.x = -Math.PI / 2;
  pathBase.position.set(0, 0.018, 12.5);
  root.add(pathBase);

  // Path edge gravel strips
  for (const side of [-1.35, 1.35]) {
    const edge = mesh(
      new THREE.PlaneGeometry(0.35, 24),
      mat(COL.stoneDark, { roughness: 0.98 }),
      false,
      true
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(side, 0.02, 12.5);
    root.add(edge);
  }

  for (let i = 0; i < 42; i++) {
    const w = 0.32 + rng() * 0.42;
    const d = 0.28 + rng() * 0.38;
    const h = 0.05 + rng() * 0.04;
    const stoneCol = rng() > 0.55 ? COL.stone : rng() > 0.5 ? COL.stoneLight : COL.stoneDark;
    const flag = box(w, h, d, stoneCol, { roughness: 0.92 });
    const lane = (rng() - 0.5) * 1.7;
    flag.position.set(lane, 0.035 + h * 0.5, 3.2 + i * 0.52 + rng() * 0.15);
    flag.rotation.y = rng() * Math.PI;
    flag.rotation.x = (rng() - 0.5) * 0.06;
    flag.rotation.z = (rng() - 0.5) * 0.05;
    root.add(flag);
  }

  // ——— Multi-layer trees ———
  function makeTree(x, z, scale = 1) {
    const g = new THREE.Group();
    const trunkH = 1.6 + rng() * 0.5;
    const trunk = cyl(
      0.08 * scale,
      0.16 * scale + rng() * 0.04 * scale,
      trunkH * scale,
      0x3a2a1a,
      { roughness: 0.95 },
      10
    );
    trunk.position.y = (trunkH * scale) / 2;
    g.add(trunk);

    // Secondary branch stubs
    const branchCount = 1 + Math.floor(rng() * 2);
    for (let b = 0; b < branchCount; b++) {
      const br = cyl(0.03 * scale, 0.05 * scale, 0.45 * scale, 0x3a2a1a, { roughness: 0.95 }, 6);
      br.position.set(
        (rng() - 0.5) * 0.15 * scale,
        (0.7 + rng() * 0.5) * trunkH * scale,
        (rng() - 0.5) * 0.15 * scale
      );
      br.rotation.z = (rng() - 0.5) * 0.9;
      br.rotation.x = (rng() - 0.5) * 0.6;
      g.add(br);
    }

    const foliageColors = [0x1a3020, 0x152818, 0x203828, 0x183020, 0x122418];
    const layers = 4 + Math.floor(rng() * 2);
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const r = (1.15 - t * 0.55 + (rng() - 0.5) * 0.1) * scale;
      const h = (1.1 + (1 - t) * 0.35) * scale;
      const segs = 8;
      const foliage = mesh(
        new THREE.ConeGeometry(r, h, segs),
        mat(foliageColors[i % foliageColors.length], { roughness: 0.96 }),
        true,
        false
      );
      foliage.position.y = trunkH * scale * 0.85 + i * 0.55 * scale + h * 0.25;
      foliage.rotation.y = rng() * Math.PI;
      foliage.position.x += (rng() - 0.5) * 0.12 * scale;
      foliage.position.z += (rng() - 0.5) * 0.12 * scale;
      g.add(foliage);
    }

    // Ground ring at base
    const baseRing = mesh(
      new THREE.CircleGeometry(0.35 * scale, 10),
      mat(0x2a2218, { roughness: 1 }),
      false,
      true
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.01;
    g.add(baseRing);

    g.position.set(x, 0, z);
    root.add(g);
    return g;
  }

  const treePositions = [
    [-6.2, 7.5], [-8.5, 13.5], [-5.2, 18.2], [7.2, 9.8], [9.4, 15.5], [5.1, 19.8],
    [-12.2, 6.2], [12.5, 8.1], [-10.4, 21.5], [11.2, 23.8], [-14.1, 12.2], [14.3, 14.1],
    [-7.3, 27.5], [6.4, 29.8], [-16.2, 17.8], [16.1, 19.5], [-4.2, 3.1], [5.3, 4.4],
    [-9.1, 4.5], [8.8, 5.2], [-15.5, 24], [13.8, 26], [-3.5, 32], [4.2, 33],
    [-18, 10], [18, 12], [-11, 30], [10, 31],
  ];
  treePositions.forEach(([x, z], i) => makeTree(x, z, 0.72 + (i % 6) * 0.1 + rng() * 0.08));

  // ——— Path lanterns ———
  function makeLantern(x, z) {
    const g = new THREE.Group();
    const post = cyl(0.05, 0.07, 1.6, COL.woodDark, { roughness: 0.9 }, 8);
    post.position.y = 0.8;
    g.add(post);
    const arm = box(0.06, 0.06, 0.35, COL.woodDark);
    arm.position.set(0, 1.55, 0.12);
    g.add(arm);
    const housing = box(0.22, 0.28, 0.22, COL.wood, { roughness: 0.7 });
    housing.position.set(0, 1.45, 0.28);
    g.add(housing);
    const pane = box(0.16, 0.18, 0.02, COL.windowGlow, {
      emissive: COL.lamp,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });
    pane.position.set(0, 1.45, 0.4);
    g.add(pane);
    const roofCap = mesh(
      new THREE.ConeGeometry(0.16, 0.12, 4),
      mat(COL.roofTile, { roughness: 0.85 })
    );
    roofCap.position.set(0, 1.68, 0.28);
    g.add(roofCap);
    const light = new THREE.PointLight(0xffcc88, 0.35, 6, 2);
    light.position.set(0, 1.45, 0.28);
    g.add(light);
    g.position.set(x, 0, z);
    root.add(g);
    return g;
  }

  const lanternZs = [5.5, 9, 13, 17, 21];
  lanternZs.forEach((z, i) => {
    makeLantern(-1.55, z + (i % 2) * 0.3);
    makeLantern(1.55, z + ((i + 1) % 2) * 0.25);
  });

  // ——— Distant city silhouette ———
  function makeCityBuilding(x, z, w, h, d, style) {
    const g = new THREE.Group();
    const bodyCol = style === 0 ? COL.city : style === 1 ? COL.cityMid : COL.cityDark;
    const body = box(w, h, d, bodyCol, { roughness: 0.92 });
    body.position.y = h / 2;
    g.add(body);

    // Roof variety
    if (style === 0) {
      // peaked
      const roof = mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.72, 0.6 + rng() * 0.8, 4),
        mat(COL.cityDark, { roughness: 0.9 })
      );
      roof.position.y = h + 0.35;
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
    } else if (style === 1) {
      // stepped top
      const cap = box(w * 0.7, 0.4 + rng() * 0.6, d * 0.7, COL.cityDark, { roughness: 0.9 });
      cap.position.y = h + 0.25;
      g.add(cap);
      if (rng() > 0.5) {
        const spire = cyl(0.08, 0.12, 0.8 + rng() * 1.2, COL.cityDark, {}, 6);
        spire.position.y = h + 0.9;
        g.add(spire);
      }
    } else {
      // flat with parapet
      const parapet = box(w * 1.05, 0.25, d * 1.05, COL.cityMid, { roughness: 0.9 });
      parapet.position.y = h + 0.1;
      g.add(parapet);
    }

    // Window lights — grid with some off
    const floors = Math.max(2, Math.floor(h / 1.1));
    const cols = Math.max(1, Math.floor(w / 0.7));
    for (let fy = 0; fy < floors; fy++) {
      for (let fx = 0; fx < cols; fx++) {
        if (rng() > 0.45) continue;
        const win = box(0.18 + rng() * 0.1, 0.22 + rng() * 0.12, 0.04, 0xffcc88, {
          emissive: 0xffaa55,
          emissiveIntensity: 0.35 + rng() * 0.55,
          roughness: 0.5,
        });
        win.position.set(
          -w / 2 + 0.35 + fx * (w - 0.5) / Math.max(1, cols - 1 || 1),
          0.55 + fy * (h - 0.8) / Math.max(1, floors - 1 || 1),
          d / 2 + 0.02
        );
        if (cols === 1) win.position.x = 0;
        g.add(win);
      }
    }

    g.position.set(x, 0, z);
    root.add(g);
  }

  for (let i = 0; i < 28; i++) {
    const angle = -0.75 + (i / 27) * 1.5;
    const dist = 40 + rng() * 22;
    const w = 1.6 + rng() * 3.5;
    const h = 2.5 + rng() * 10;
    const d = 1.5 + rng() * 2.5;
    makeCityBuilding(
      Math.sin(angle) * dist + (rng() - 0.5) * 4,
      -Math.cos(angle) * dist - 10 + (rng() - 0.5) * 3,
      w,
      h,
      d,
      Math.floor(rng() * 3)
    );
  }

  // Extra mid-distance towers
  for (let i = 0; i < 6; i++) {
    const angle = -0.5 + (i / 5) * 1.0;
    const dist = 55 + rng() * 12;
    makeCityBuilding(
      Math.sin(angle) * dist,
      -Math.cos(angle) * dist - 12,
      2 + rng() * 2,
      10 + rng() * 8,
      2 + rng(),
      1
    );
  }

  // ——— Stars ———
  {
    const starCount = 400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(0.15 + rng() * 0.75); // upper hemisphere bias
      const r = 90 + rng() * 40;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 8;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 20;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xc8d4f0,
        size: 0.18,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    root.add(stars);
  }

  // ——— Moon with soft glow ———
  const moonGroup = new THREE.Group();
  const moon = mesh(
    new THREE.SphereGeometry(2.4, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xdde8ff,
      emissive: 0xaabbdd,
      emissiveIntensity: 0.45,
      roughness: 0.95,
      metalness: 0,
    }),
    false,
    false
  );
  moonGroup.add(moon);

  // Soft glow shells
  for (let i = 0; i < 3; i++) {
    const glow = mesh(
      new THREE.SphereGeometry(2.6 + i * 0.55, 24, 16),
      mat(0xaabbff, {
        transparent: true,
        opacity: 0.07 - i * 0.02,
        roughness: 1,
        metalness: 0,
        side: THREE.BackSide,
        emissive: 0x8899cc,
        emissiveIntensity: 0.15,
      }),
      false,
      false
    );
    moonGroup.add(glow);
  }

  moonGroup.position.set(-18, 22, -30);
  root.add(moonGroup);
  const moonGlow = new THREE.PointLight(0xaabbff, 0.5, 140);
  moonGlow.position.copy(moonGroup.position);
  root.add(moonGlow);

  // ——— Philosopher's house ———
  const house = new THREE.Group();
  house.name = 'house';
  house.position.set(0, 0, 0);
  root.add(house);

  const wallH = 3.2;
  const floorY = 0.22;

  // Stone foundation base
  const foundation = box(8.4, 0.28, 7.4, COL.stone, { roughness: 0.92 });
  foundation.position.set(0, 0.14, -0.5);
  house.add(foundation);

  // Foundation stone courses (horizontal bands)
  for (let i = 0; i < 3; i++) {
    const course = box(8.45, 0.04, 7.45, i % 2 ? COL.stoneLight : COL.stoneDark, { roughness: 0.9 });
    course.position.set(0, 0.06 + i * 0.09, -0.5);
    house.add(course);
  }

  // Corner foundation blocks
  for (const [cx, cz] of [
    [-4.0, 3.0], [4.0, 3.0], [-4.0, -4.0], [4.0, -4.0],
  ]) {
    const block = box(0.35, 0.32, 0.35, COL.stoneLight, { roughness: 0.88 });
    block.position.set(cx, 0.16, cz - 0.5);
    house.add(block);
  }

  // Raised floor platform
  const floor = box(7.9, 0.12, 6.9, COL.woodDark, { roughness: 0.75 });
  floor.position.set(0, floorY, -0.5);
  house.add(floor);

  // Floorboards — richer variation
  for (let i = 0; i < 14; i++) {
    const plankW = 7.7;
    const plankD = 0.42 + (i % 3) * 0.04;
    const plankCol =
      i % 3 === 0 ? COL.wood : i % 3 === 1 ? COL.woodDark : COL.woodMid;
    const plank = box(plankW, 0.018, plankD, plankCol, { roughness: 0.78 + (i % 4) * 0.03 });
    plank.position.set((i % 2) * 0.02 - 0.01, floorY + 0.07, -3.55 + i * 0.48);
    house.add(plank);
    // subtle gap line
    if (i < 13) {
      const gap = box(plankW, 0.008, 0.015, 0x1a120c, { roughness: 1 });
      gap.position.set(0, floorY + 0.072, -3.55 + i * 0.48 + plankD / 2);
      house.add(gap);
    }
  }

  // Walls with wainscoting / baseboard
  const wallMat = mat(COL.plaster, { roughness: 0.92 });
  const wainscotMat = mat(COL.woodMid, { roughness: 0.8 });
  const baseboardMat = mat(COL.woodDark, { roughness: 0.75 });

  function addWallWithTrim(meshWall, w, d, isLong) {
    house.add(meshWall);
    // wainscoting panel height ~0.9
    const ww = isLong ? w : 0.06;
    const wd = isLong ? 0.06 : d;
    const wain = mesh(new THREE.BoxGeometry(ww, 0.9, wd), wainscotMat);
    wain.position.copy(meshWall.position);
    wain.position.y = floorY + 0.52;
    // offset slightly inward for long walls facing interior
    house.add(wain);
    // baseboard
    const bb = mesh(new THREE.BoxGeometry(ww, 0.1, wd), baseboardMat);
    bb.position.copy(meshWall.position);
    bb.position.y = floorY + 0.12;
    house.add(bb);
    // chair rail
    const rail = mesh(new THREE.BoxGeometry(ww, 0.05, wd), baseboardMat);
    rail.position.copy(meshWall.position);
    rail.position.y = floorY + 0.95;
    house.add(rail);
  }

  const wallBack = mesh(new THREE.BoxGeometry(8, wallH, 0.22), wallMat);
  wallBack.position.set(0, wallH / 2 + 0.05, -4);
  addWallWithTrim(wallBack, 7.9, 0.08, true);
  // push trim inward on back wall
  // (wainscot already placed at wall center — fine for visual)

  const wallLeft = mesh(new THREE.BoxGeometry(0.22, wallH, 7), wallMat);
  wallLeft.position.set(-4, wallH / 2 + 0.05, -0.5);
  house.add(wallLeft);
  {
    const wain = box(0.06, 0.9, 6.8, COL.woodMid, { roughness: 0.8 });
    wain.position.set(-3.88, floorY + 0.52, -0.5);
    house.add(wain);
    const bb = box(0.07, 0.1, 6.85, COL.woodDark, { roughness: 0.75 });
    bb.position.set(-3.87, floorY + 0.12, -0.5);
    house.add(bb);
    const rail = box(0.07, 0.05, 6.85, COL.woodDark, { roughness: 0.75 });
    rail.position.set(-3.87, floorY + 0.95, -0.5);
    house.add(rail);
  }

  const wallRight = mesh(new THREE.BoxGeometry(0.22, wallH, 7), wallMat);
  wallRight.position.set(4, wallH / 2 + 0.05, -0.5);
  house.add(wallRight);
  {
    const wain = box(0.06, 0.9, 6.8, COL.woodMid, { roughness: 0.8 });
    wain.position.set(3.88, floorY + 0.52, -0.5);
    house.add(wain);
    const bb = box(0.07, 0.1, 6.85, COL.woodDark, { roughness: 0.75 });
    bb.position.set(3.87, floorY + 0.12, -0.5);
    house.add(bb);
    const rail = box(0.07, 0.05, 6.85, COL.woodDark, { roughness: 0.75 });
    rail.position.set(3.87, floorY + 0.95, -0.5);
    house.add(rail);
  }

  // Front wall segments (door opening)
  const frontLeft = box(2.6, wallH, 0.22, COL.plaster);
  frontLeft.position.set(-2.7, wallH / 2 + 0.05, 3);
  house.add(frontLeft);
  const frontRight = box(2.6, wallH, 0.22, COL.plaster);
  frontRight.position.set(2.7, wallH / 2 + 0.05, 3);
  house.add(frontRight);
  const frontTop = box(2.8, 0.95, 0.22, COL.plaster);
  frontTop.position.set(0, wallH - 0.4, 3);
  house.add(frontTop);

  // Front wainscot on side segments
  for (const sx of [-2.7, 2.7]) {
    const wain = box(2.5, 0.9, 0.06, COL.woodMid, { roughness: 0.8 });
    wain.position.set(sx, floorY + 0.52, 2.88);
    house.add(wain);
    const bb = box(2.5, 0.1, 0.07, COL.woodDark);
    bb.position.set(sx, floorY + 0.12, 2.87);
    house.add(bb);
  }

  // Door frame
  const doorFrameL = box(0.12, 2.35, 0.18, COL.woodDark, { roughness: 0.7 });
  doorFrameL.position.set(-0.62, 1.25, 3.05);
  house.add(doorFrameL);
  const doorFrameR = box(0.12, 2.35, 0.18, COL.woodDark, { roughness: 0.7 });
  doorFrameR.position.set(0.62, 1.25, 3.05);
  house.add(doorFrameR);
  const doorFrameT = box(1.36, 0.12, 0.18, COL.woodDark, { roughness: 0.7 });
  doorFrameT.position.set(0, 2.45, 3.05);
  house.add(doorFrameT);
  const threshold = box(1.3, 0.08, 0.28, COL.stoneLight, { roughness: 0.85 });
  threshold.position.set(0, floorY + 0.02, 3.1);
  house.add(threshold);

  // Paneled door (slightly ajar)
  const doorGroup = new THREE.Group();
  doorGroup.position.set(-0.55, 0, 3.05);
  doorGroup.rotation.y = -0.55;
  const doorBody = box(1.08, 2.2, 0.07, COL.wood, { roughness: 0.68 });
  doorBody.position.set(0.54, 1.18, 0);
  doorGroup.add(doorBody);
  // panels (4)
  const panelPositions = [
    [0.54, 1.7, 0.04],
    [0.54, 1.15, 0.04],
    [0.54, 0.7, 0.04],
  ];
  // Actually two columns x two rows
  for (const py of [1.65, 0.85]) {
    for (const px of [0.32, 0.76]) {
      const panel = box(0.36, 0.55, 0.02, COL.woodDark, { roughness: 0.72 });
      panel.position.set(px, py, 0.045);
      doorGroup.add(panel);
      const panelInner = box(0.28, 0.45, 0.015, COL.woodMid, { roughness: 0.7 });
      panelInner.position.set(px, py, 0.055);
      doorGroup.add(panelInner);
    }
  }
  // mid rail & stiles already implied by panels
  const midRail = box(1.0, 0.08, 0.08, COL.woodDark, { roughness: 0.65 });
  midRail.position.set(0.54, 1.25, 0.02);
  doorGroup.add(midRail);
  // handle plate + knob
  const plate = box(0.08, 0.16, 0.02, COL.brass, { metalness: 0.7, roughness: 0.35 });
  plate.position.set(0.95, 1.1, 0.05);
  doorGroup.add(plate);
  const knob = cyl(0.035, 0.035, 0.06, COL.brass, { metalness: 0.65, roughness: 0.3 }, 10);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.95, 1.1, 0.09);
  doorGroup.add(knob);
  const knobBall = sphere(0.04, COL.brass, { metalness: 0.7, roughness: 0.28 }, 10, 8);
  knobBall.position.set(0.95, 1.1, 0.13);
  doorGroup.add(knobBall);
  house.add(doorGroup);

  // ——— Segmented roof with eaves ———
  const roofGroup = new THREE.Group();
  // Main hip-like roof from two large slopes + side fills using boxes + cones
  // Front slope
  const roofFront = box(8.8, 0.12, 4.2, COL.roof, { roughness: 0.88 });
  roofFront.position.set(0, wallH + 0.55, 1.3);
  roofFront.rotation.x = -0.42;
  roofGroup.add(roofFront);
  // Back slope
  const roofBack = box(8.8, 0.12, 4.2, COL.roofDark, { roughness: 0.88 });
  roofBack.position.set(0, wallH + 0.55, -2.3);
  roofBack.rotation.x = 0.42;
  roofGroup.add(roofBack);
  // Ridge beam
  const ridge = box(8.6, 0.14, 0.2, COL.woodDark, { roughness: 0.75 });
  ridge.position.set(0, wallH + 1.35, -0.5);
  roofGroup.add(ridge);
  // Tile strips (visual segmentation)
  for (let i = 0; i < 7; i++) {
    const tFront = box(8.6, 0.04, 0.35, i % 2 ? COL.roofTile : COL.roof, { roughness: 0.9 });
    tFront.position.set(0, wallH + 0.35 + i * 0.14, 2.5 - i * 0.45);
    tFront.rotation.x = -0.42;
    roofGroup.add(tFront);
    const tBack = box(8.6, 0.04, 0.35, i % 2 ? COL.roof : COL.roofTile, { roughness: 0.9 });
    tBack.position.set(0, wallH + 0.35 + i * 0.14, -3.5 + i * 0.45);
    tBack.rotation.x = 0.42;
    roofGroup.add(tBack);
  }
  // Gable end fills (triangular-ish via wedges of boxes)
  for (const side of [-1, 1]) {
    const gable = mesh(
      new THREE.ConeGeometry(3.6, 1.6, 3),
      mat(COL.plasterDark, { roughness: 0.9 })
    );
    gable.position.set(side * 4.0, wallH + 0.55, -0.5);
    gable.rotation.z = side * Math.PI / 2;
    gable.rotation.y = Math.PI / 2;
    gable.scale.set(1, 1, 0.35);
    roofGroup.add(gable);
  }
  // Eaves overhang boards
  const eaveFront = box(9.0, 0.08, 0.35, COL.woodDark, { roughness: 0.8 });
  eaveFront.position.set(0, wallH + 0.12, 3.25);
  roofGroup.add(eaveFront);
  const eaveBack = box(9.0, 0.08, 0.35, COL.woodDark, { roughness: 0.8 });
  eaveBack.position.set(0, wallH + 0.12, -4.25);
  roofGroup.add(eaveBack);
  for (const sx of [-4.15, 4.15]) {
    const eaveSide = box(0.3, 0.08, 7.6, COL.woodDark, { roughness: 0.8 });
    eaveSide.position.set(sx, wallH + 0.12, -0.5);
    roofGroup.add(eaveSide);
  }
  // Rafter tips under eaves
  for (let i = 0; i < 9; i++) {
    const rafter = box(0.08, 0.1, 0.4, COL.wood, { roughness: 0.85 });
    rafter.position.set(-3.6 + i * 0.9, wallH + 0.05, 3.35);
    roofGroup.add(rafter);
  }
  house.add(roofGroup);

  // ——— Ceiling beams (interior) ———
  for (let i = 0; i < 5; i++) {
    const beam = box(7.6, 0.14, 0.18, COL.woodDark, { roughness: 0.8 });
    beam.position.set(0, wallH - 0.12, -3.2 + i * 1.35);
    house.add(beam);
  }
  // Cross beam
  const crossBeam = box(0.16, 0.12, 6.5, COL.woodDark, { roughness: 0.8 });
  crossBeam.position.set(0, wallH - 0.2, -0.5);
  house.add(crossBeam);

  // Ceiling plane (soft)
  const ceiling = mesh(
    new THREE.BoxGeometry(7.7, 0.04, 6.7),
    mat(COL.plasterWarm, { roughness: 0.95 }),
    false,
    true
  );
  ceiling.position.set(0, wallH - 0.02, -0.5);
  house.add(ceiling);

  // ——— Porch with posts, beam, steps ———
  const porchGroup = new THREE.Group();
  const porchDeck = box(4.4, 0.12, 2.4, COL.woodDark, { roughness: 0.8 });
  porchDeck.position.set(0, 0.12, 4.35);
  porchGroup.add(porchDeck);
  // porch floorboards
  for (let i = 0; i < 6; i++) {
    const pb = box(4.2, 0.02, 0.32, i % 2 ? COL.wood : COL.woodMid, { roughness: 0.82 });
    pb.position.set(0, 0.19, 3.4 + i * 0.35);
    porchGroup.add(pb);
  }
  // Posts with capitals
  for (const px of [-1.7, 1.7]) {
    const post = cyl(0.09, 0.11, 2.55, COL.wood, { roughness: 0.78 }, 12);
    post.position.set(px, 1.45, 5.2);
    porchGroup.add(post);
    const base = box(0.28, 0.12, 0.28, COL.woodDark);
    base.position.set(px, 0.24, 5.2);
    porchGroup.add(base);
    const capital = box(0.26, 0.1, 0.26, COL.woodDark);
    capital.position.set(px, 2.72, 5.2);
    porchGroup.add(capital);
  }
  // Beam across posts
  const porchBeam = box(3.8, 0.16, 0.2, COL.woodDark, { roughness: 0.75 });
  porchBeam.position.set(0, 2.78, 5.15);
  porchGroup.add(porchBeam);
  // Porch roof
  const porchRoof = box(4.6, 0.1, 2.6, COL.roofTile, { roughness: 0.88 });
  porchRoof.position.set(0, 2.95, 4.4);
  porchRoof.rotation.x = -0.1;
  porchGroup.add(porchRoof);
  // Porch roof tiles
  for (let i = 0; i < 5; i++) {
    const tile = box(4.5, 0.03, 0.35, i % 2 ? COL.roof : COL.roofTile, { roughness: 0.9 });
    tile.position.set(0, 2.88 + i * 0.03, 5.3 - i * 0.4);
    tile.rotation.x = -0.1;
    porchGroup.add(tile);
  }
  // Steps (3)
  for (let s = 0; s < 3; s++) {
    const step = box(2.4 - s * 0.15, 0.12, 0.4, COL.stone, { roughness: 0.9 });
    step.position.set(0, 0.06 + s * 0.12, 5.65 + s * 0.35);
    porchGroup.add(step);
    const tread = box(2.35 - s * 0.15, 0.03, 0.38, COL.stoneLight, { roughness: 0.85 });
    tread.position.set(0, 0.13 + s * 0.12, 5.65 + s * 0.35);
    porchGroup.add(tread);
  }
  house.add(porchGroup);

  // ——— Detailed windows with frames + muntins + warm glow ———
  function makeWindow(x, y, z, rotY = 0) {
    const g = new THREE.Group();
    // Outer frame
    const outer = box(1.25, 1.15, 0.14, COL.woodDark, { roughness: 0.7 });
    g.add(outer);
    // Inner reveal
    const inner = box(1.05, 0.95, 0.08, COL.wood, { roughness: 0.72 });
    inner.position.z = 0.02;
    g.add(inner);
    // Glow glass panes 2x2
    const paneW = 0.42;
    const paneH = 0.38;
    for (const ox of [-0.24, 0.24]) {
      for (const oy of [0.22, -0.2]) {
        const glass = box(paneW, paneH, 0.03, COL.windowGlow, {
          emissive: COL.windowGlow,
          emissiveIntensity: 0.6,
          roughness: 0.25,
          metalness: 0.05,
        });
        glass.position.set(ox, oy, 0.06);
        g.add(glass);
      }
    }
    // Muntins (cross bars)
    const muntinV = box(0.05, 0.88, 0.04, COL.woodDark, { roughness: 0.65 });
    muntinV.position.z = 0.08;
    g.add(muntinV);
    const muntinH = box(0.95, 0.05, 0.04, COL.woodDark, { roughness: 0.65 });
    muntinH.position.z = 0.08;
    g.add(muntinH);
    // Sill
    const sill = box(1.35, 0.08, 0.2, COL.wood, { roughness: 0.75 });
    sill.position.set(0, -0.62, 0.05);
    g.add(sill);
    // Header
    const header = box(1.35, 0.08, 0.16, COL.woodDark, { roughness: 0.7 });
    header.position.set(0, 0.62, 0.02);
    g.add(header);

    g.position.set(x, y, z);
    g.rotation.y = rotY;
    house.add(g);
    return g;
  }

  makeWindow(-4.08, 1.85, -1.5, Math.PI / 2);
  makeWindow(-4.08, 1.85, 0.8, Math.PI / 2);
  makeWindow(4.08, 1.85, -1.5, -Math.PI / 2);
  makeWindow(4.08, 1.85, 0.8, -Math.PI / 2);
  makeWindow(-1.8, 1.95, -4.08, 0);
  makeWindow(1.8, 1.95, -4.08, 0);

  // ——— Bookshelves with varied books ———
  function makeBookshelf(x, z, w = 2.2) {
    const shelf = new THREE.Group();
    // Carcass
    const body = box(w, 2.55, 0.42, COL.wood, { roughness: 0.75 });
    body.position.y = 1.4;
    shelf.add(body);
    // Back panel slightly inset
    const back = box(w - 0.08, 2.4, 0.04, COL.woodDark, { roughness: 0.85 });
    back.position.set(0, 1.4, -0.18);
    shelf.add(back);
    // Side moldings
    for (const sx of [-w / 2 + 0.03, w / 2 - 0.03]) {
      const stile = box(0.06, 2.55, 0.44, COL.woodDark, { roughness: 0.7 });
      stile.position.set(sx, 1.4, 0);
      shelf.add(stile);
    }
    // Crown
    const crown = box(w + 0.1, 0.1, 0.48, COL.woodLight, { roughness: 0.7 });
    crown.position.y = 2.72;
    shelf.add(crown);

    const rows = 5;
    for (let row = 0; row < rows; row++) {
      const boardY = 0.38 + row * 0.48;
      const board = box(w - 0.12, 0.05, 0.38, COL.woodLight, { roughness: 0.72 });
      board.position.set(0, boardY, 0.02);
      shelf.add(board);

      let bx = -w / 2 + 0.14;
      while (bx < w / 2 - 0.14) {
        const bw = 0.06 + rng() * 0.12;
        const bh = 0.22 + rng() * 0.2;
        const bd = 0.22 + rng() * 0.1;
        const color = COL.bookSpine[Math.floor(rng() * COL.bookSpine.length)];
        const lean = (rng() - 0.5) * 0.08;
        const book = box(bw, bh, bd, color, { roughness: 0.65 + rng() * 0.2 });
        book.position.set(bx + bw / 2, boardY + bh / 2 + 0.03, 0.04 + (rng() - 0.5) * 0.04);
        book.rotation.z = lean;
        shelf.add(book);
        // occasional gold band
        if (rng() > 0.7) {
          const band = box(bw * 1.02, 0.015, bd * 0.9, COL.brass, {
            metalness: 0.5,
            roughness: 0.4,
          });
          band.position.set(book.position.x, boardY + bh * 0.55, book.position.z + 0.01);
          shelf.add(band);
        }
        bx += bw + 0.012 + rng() * 0.02;
      }
    }
    shelf.position.set(x, 0, z);
    house.add(shelf);
    return shelf;
  }

  makeBookshelf(-2.15, -3.72, 2.5);
  makeBookshelf(2.15, -3.72, 2.5);

  // ——— Desk with lamp, papers, ink ———
  const deskGroup = new THREE.Group();
  deskGroup.position.set(-2.4, 0, -2.0);
  const deskTop = box(1.7, 0.07, 0.85, COL.woodLight, { roughness: 0.55 });
  deskTop.position.y = 0.88;
  deskGroup.add(deskTop);
  // desk apron
  const apron = box(1.6, 0.1, 0.75, COL.wood, { roughness: 0.7 });
  apron.position.y = 0.8;
  deskGroup.add(apron);
  // drawer face
  const drawer = box(0.5, 0.1, 0.02, COL.woodMid, { roughness: 0.65 });
  drawer.position.set(0, 0.8, 0.4);
  deskGroup.add(drawer);
  const drawerKnob = sphere(0.025, COL.brass, { metalness: 0.6, roughness: 0.35 }, 8, 6);
  drawerKnob.position.set(0, 0.8, 0.43);
  deskGroup.add(drawerKnob);
  for (const [lx, lz] of [
    [-0.72, -0.32], [0.72, -0.32], [-0.72, 0.32], [0.72, 0.32],
  ]) {
    const leg = box(0.09, 0.82, 0.09, COL.woodDark, { roughness: 0.75 });
    leg.position.set(lx, 0.42, lz);
    deskGroup.add(leg);
  }
  // papers stack
  for (let p = 0; p < 3; p++) {
    const paper = box(0.32 + p * 0.02, 0.008, 0.4, COL.paper, { roughness: 0.92 });
    paper.position.set(0.25, 0.93 + p * 0.01, 0.05);
    paper.rotation.y = 0.08 + p * 0.05;
    deskGroup.add(paper);
  }
  // open sheet with lines
  const sheet = box(0.38, 0.006, 0.48, 0xf2ead8, { roughness: 0.9 });
  sheet.position.set(-0.15, 0.925, -0.05);
  sheet.rotation.y = -0.2;
  deskGroup.add(sheet);
  for (let li = 0; li < 5; li++) {
    const line = box(0.28, 0.003, 0.008, COL.scrollInk, { roughness: 1 });
    line.position.set(-0.15, 0.93, -0.18 + li * 0.07);
    line.rotation.y = -0.2;
    deskGroup.add(line);
  }
  // ink pot
  const inkPot = cyl(0.045, 0.055, 0.09, COL.ink, { roughness: 0.4, metalness: 0.1 }, 12);
  inkPot.position.set(-0.55, 0.96, 0.15);
  deskGroup.add(inkPot);
  const inkRim = cyl(0.05, 0.05, 0.015, COL.brass, { metalness: 0.5, roughness: 0.4 }, 12);
  inkRim.position.set(-0.55, 1.01, 0.15);
  deskGroup.add(inkRim);
  // quill
  const quill = cyl(0.008, 0.015, 0.28, 0xe8dcc8, { roughness: 0.7 }, 6);
  quill.position.set(-0.42, 0.98, 0.2);
  quill.rotation.z = 0.9;
  quill.rotation.y = 0.3;
  deskGroup.add(quill);
  // desk lamp
  const lampBase = cyl(0.08, 0.1, 0.04, COL.brass, { metalness: 0.55, roughness: 0.4 }, 12);
  lampBase.position.set(0.55, 0.94, -0.2);
  deskGroup.add(lampBase);
  const lampStem = cyl(0.015, 0.02, 0.35, COL.brass, { metalness: 0.55, roughness: 0.35 }, 8);
  lampStem.position.set(0.55, 1.12, -0.2);
  deskGroup.add(lampStem);
  const deskShade = mesh(
    new THREE.ConeGeometry(0.14, 0.16, 14, 1, true),
    mat(0xf0d8a8, {
      emissive: COL.lamp,
      emissiveIntensity: 0.4,
      roughness: 0.55,
      side: THREE.DoubleSide,
    })
  );
  deskShade.position.set(0.55, 1.32, -0.2);
  deskGroup.add(deskShade);
  const deskLampLight = new THREE.PointLight(COL.lamp, 0.45, 3.5, 2);
  deskLampLight.position.set(0.55, 1.28, -0.2);
  deskGroup.add(deskLampLight);
  house.add(deskGroup);

  // ——— Armchairs with cushions ———
  function makeChair(x, z, rotY, color = COL.wood) {
    const g = new THREE.Group();
    // seat frame
    const seat = box(0.72, 0.07, 0.72, color, { roughness: 0.68 });
    seat.position.y = 0.5;
    g.add(seat);
    // seat cushion (plump)
    const cushion = box(0.64, 0.1, 0.64, COL.cushion, { roughness: 0.95 });
    cushion.position.y = 0.58;
    g.add(cushion);
    const cushionTop = box(0.58, 0.04, 0.58, COL.cushionAlt, { roughness: 0.92 });
    cushionTop.position.y = 0.64;
    g.add(cushionTop);
    // back
    const back = box(0.72, 0.85, 0.08, color, { roughness: 0.68 });
    back.position.set(0, 0.95, -0.32);
    g.add(back);
    // back cushion
    const backCush = box(0.6, 0.55, 0.08, COL.cushion, { roughness: 0.95 });
    backCush.position.set(0, 0.95, -0.26);
    g.add(backCush);
    // legs slightly tapered look
    for (const [lx, lz] of [
      [-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28],
    ]) {
      const leg = box(0.065, 0.48, 0.065, COL.woodDark, { roughness: 0.75 });
      leg.position.set(lx, 0.24, lz);
      g.add(leg);
    }
    // arms
    for (const ax of [-0.38, 0.38]) {
      const arm = box(0.08, 0.08, 0.58, color, { roughness: 0.68 });
      arm.position.set(ax, 0.74, -0.02);
      g.add(arm);
      const armPost = box(0.07, 0.28, 0.07, color, { roughness: 0.7 });
      armPost.position.set(ax, 0.62, 0.24);
      g.add(armPost);
    }
    // top rail curve hint
    const topRail = box(0.74, 0.06, 0.1, color, { roughness: 0.65 });
    topRail.position.set(0, 1.38, -0.32);
    g.add(topRail);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    house.add(g);
    return g;
  }
  makeChair(anchors.philosopherSeat.x, anchors.philosopherSeat.z, 0.35, 0x4a3028);
  makeChair(anchors.youthSeat.x, anchors.youthSeat.z, -0.55, 0x3a2820);

  // ——— Low tea table with ceramic set ———
  const teaGroup = new THREE.Group();
  teaGroup.position.set(0, 0, -1.25);
  const tableTop = box(1.15, 0.06, 0.72, COL.woodLight, { roughness: 0.55 });
  tableTop.position.y = 0.55;
  teaGroup.add(tableTop);
  // beveled edge look
  const tableEdge = box(1.18, 0.03, 0.75, COL.wood, { roughness: 0.6 });
  tableEdge.position.y = 0.52;
  teaGroup.add(tableEdge);
  for (const [tx, tz] of [
    [-0.45, -0.26], [0.45, -0.26], [-0.45, 0.26], [0.45, 0.26],
  ]) {
    const leg = box(0.055, 0.5, 0.055, COL.woodDark, { roughness: 0.75 });
    leg.position.set(tx, 0.27, tz);
    teaGroup.add(leg);
  }
  // teapot body
  const pot = cyl(0.1, 0.13, 0.15, COL.ceramic, { roughness: 0.4 }, 14);
  pot.position.set(0, 0.66, 0);
  teaGroup.add(pot);
  const potShoulder = cyl(0.09, 0.1, 0.04, COL.ceramic, { roughness: 0.4 }, 14);
  potShoulder.position.set(0, 0.75, 0);
  teaGroup.add(potShoulder);
  const potLid = cyl(0.07, 0.08, 0.03, 0x2a3a2a, { roughness: 0.45 }, 12);
  potLid.position.set(0, 0.78, 0);
  teaGroup.add(potLid);
  const potKnob = sphere(0.02, 0x2a3a2a, { roughness: 0.45 }, 8, 6);
  potKnob.position.set(0, 0.81, 0);
  teaGroup.add(potKnob);
  // spout
  const spout = cyl(0.018, 0.025, 0.12, COL.ceramic, { roughness: 0.4 }, 8);
  spout.position.set(0.12, 0.68, 0);
  spout.rotation.z = -Math.PI / 2.5;
  teaGroup.add(spout);
  // handle
  const handle = mesh(
    new THREE.TorusGeometry(0.06, 0.012, 8, 12, Math.PI),
    mat(COL.ceramic, { roughness: 0.4 })
  );
  handle.position.set(-0.12, 0.68, 0);
  handle.rotation.y = Math.PI / 2;
  handle.rotation.z = Math.PI / 2;
  teaGroup.add(handle);
  // cups + saucers
  for (const [cx, cz] of [
    [-0.3, 0.15], [0.3, 0.15], [0, -0.2],
  ]) {
    const saucer = cyl(0.07, 0.07, 0.012, COL.ceramicLight, { roughness: 0.35 }, 12);
    saucer.position.set(cx, 0.59, cz);
    teaGroup.add(saucer);
    const cup = cyl(0.045, 0.04, 0.055, COL.ceramicLight, { roughness: 0.35 }, 12);
    cup.position.set(cx, 0.625, cz);
    teaGroup.add(cup);
  }
  // tray
  const tray = box(0.7, 0.015, 0.45, COL.woodMid, { roughness: 0.5 });
  tray.position.set(0, 0.585, 0.02);
  teaGroup.add(tray);
  house.add(teaGroup);

  // ——— Patterned rug (multi-mesh) ———
  const rugGroup = new THREE.Group();
  rugGroup.position.set(0, floorY + 0.085, -1.3);
  const rugBase = mesh(
    new THREE.CircleGeometry(1.65, 32),
    mat(COL.rugBase, { roughness: 1 }),
    false,
    true
  );
  rugBase.rotation.x = -Math.PI / 2;
  rugGroup.add(rugBase);
  const rugBorder = mesh(
    new THREE.RingGeometry(1.4, 1.62, 32),
    mat(COL.rugBorder, { roughness: 1 }),
    false,
    true
  );
  rugBorder.rotation.x = -Math.PI / 2;
  rugBorder.position.y = 0.002;
  rugGroup.add(rugBorder);
  const rugInner = mesh(
    new THREE.RingGeometry(0.55, 0.75, 24),
    mat(COL.rugPattern, { roughness: 1 }),
    false,
    true
  );
  rugInner.rotation.x = -Math.PI / 2;
  rugInner.position.y = 0.003;
  rugGroup.add(rugInner);
  // diamond motifs
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const diamond = box(0.18, 0.008, 0.18, COL.rugPattern, { roughness: 1 });
    diamond.rotation.x = -Math.PI / 2;
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(Math.cos(ang) * 1.05, 0.004, Math.sin(ang) * 1.05);
    rugGroup.add(diamond);
  }
  // center medallion
  const medal = mesh(
    new THREE.CircleGeometry(0.35, 16),
    mat(COL.rugBorder, { roughness: 1 }),
    false,
    true
  );
  medal.rotation.x = -Math.PI / 2;
  medal.position.y = 0.004;
  rugGroup.add(medal);
  const medalInner = mesh(
    new THREE.CircleGeometry(0.18, 12),
    mat(COL.rugPattern, { roughness: 1 }),
    false,
    true
  );
  medalInner.rotation.x = -Math.PI / 2;
  medalInner.position.y = 0.005;
  rugGroup.add(medalInner);
  house.add(rugGroup);

  // ——— Wall scroll ———
  const scrollGroup = new THREE.Group();
  scrollGroup.position.set(0, 1.95, -3.88);
  const scrollPaper = box(0.75, 1.4, 0.025, COL.scroll, { roughness: 0.9 });
  scrollGroup.add(scrollPaper);
  // rollers
  const topRoll = cyl(0.04, 0.04, 0.85, COL.woodDark, { roughness: 0.7 }, 10);
  topRoll.rotation.z = Math.PI / 2;
  topRoll.position.set(0, 0.72, 0.02);
  scrollGroup.add(topRoll);
  const botRoll = cyl(0.04, 0.04, 0.85, COL.woodDark, { roughness: 0.7 }, 10);
  botRoll.rotation.z = Math.PI / 2;
  botRoll.position.set(0, -0.72, 0.02);
  scrollGroup.add(botRoll);
  // calligraphy strokes (abstract)
  const strokes = [
    [0, 0.25, 0.06, 0.55],
    [-0.12, -0.05, 0.05, 0.4],
    [0.12, -0.1, 0.05, 0.35],
    [0, -0.35, 0.08, 0.25],
  ];
  for (const [sx, sy, sw, sh] of strokes) {
    const stroke = box(sw, sh, 0.015, COL.scrollInk, { roughness: 1 });
    stroke.position.set(sx, sy, 0.02);
    scrollGroup.add(stroke);
  }
  // seal stamp
  const seal = box(0.1, 0.1, 0.012, 0x8a2020, { roughness: 0.8 });
  seal.position.set(0.22, -0.45, 0.02);
  scrollGroup.add(seal);
  house.add(scrollGroup);

  // ——— Bust / statue on pedestal ———
  const bustGroup = new THREE.Group();
  bustGroup.position.set(-3.35, 0, -3.45);
  const pedestal = cyl(0.14, 0.18, 0.55, COL.stone, { roughness: 0.75 }, 12);
  pedestal.position.y = 0.4;
  bustGroup.add(pedestal);
  const pedTop = cyl(0.16, 0.16, 0.04, COL.stoneLight, { roughness: 0.7 }, 12);
  pedTop.position.y = 0.7;
  bustGroup.add(pedTop);
  const shoulders = box(0.32, 0.14, 0.16, COL.stoneLight, { roughness: 0.68 });
  shoulders.position.y = 0.82;
  bustGroup.add(shoulders);
  const torso = mesh(
    new THREE.SphereGeometry(0.12, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(COL.stoneLight, { roughness: 0.68 })
  );
  torso.position.y = 0.88;
  bustGroup.add(torso);
  const head = sphere(0.11, COL.stoneLight, { roughness: 0.65 }, 14, 12);
  head.position.y = 1.08;
  bustGroup.add(head);
  // simple nose
  const nose = box(0.03, 0.05, 0.04, COL.stone, { roughness: 0.7 });
  nose.position.set(0, 1.08, 0.1);
  bustGroup.add(nose);
  house.add(bustGroup);

  // ——— Side candle table with flicker ———
  const candleGroup = new THREE.Group();
  candleGroup.position.set(3.2, 0, -2.8);
  const sideTable = box(0.55, 0.05, 0.55, COL.wood, { roughness: 0.7 });
  sideTable.position.y = 0.72;
  candleGroup.add(sideTable);
  for (const [lx, lz] of [
    [-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2],
  ]) {
    const leg = box(0.05, 0.7, 0.05, COL.woodDark);
    leg.position.set(lx, 0.36, lz);
    candleGroup.add(leg);
  }
  // candle stick
  const stick = cyl(0.03, 0.04, 0.12, COL.brass, { metalness: 0.55, roughness: 0.4 }, 10);
  stick.position.y = 0.8;
  candleGroup.add(stick);
  const candleBody = cyl(0.035, 0.038, 0.22, 0xf5f0e0, { roughness: 0.85 }, 10);
  candleBody.position.y = 0.97;
  candleGroup.add(candleBody);
  // melted wax drip
  const drip = box(0.02, 0.06, 0.02, 0xf0e8d0, { roughness: 0.9 });
  drip.position.set(0.03, 0.9, 0);
  candleGroup.add(drip);
  const flame = mesh(
    new THREE.SphereGeometry(0.035, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffaa44 })
  );
  flame.position.y = 1.12;
  flame.scale.set(0.65, 1.35, 0.65);
  candleGroup.add(flame);
  // small flame glow core
  const flameCore = mesh(
    new THREE.SphereGeometry(0.018, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffeeaa })
  );
  flameCore.position.y = 1.1;
  candleGroup.add(flameCore);
  house.add(candleGroup);

  // ——— Hanging lamp with shade ———
  const hangLamp = new THREE.Group();
  hangLamp.position.set(0, 0, -1.0);
  // chain
  for (let i = 0; i < 4; i++) {
    const link = cyl(0.015, 0.015, 0.08, 0x3a3a3a, { metalness: 0.5, roughness: 0.5 }, 6);
    link.position.y = wallH - 0.15 - i * 0.07;
    hangLamp.add(link);
  }
  const canopy = cyl(0.1, 0.06, 0.06, COL.brass, { metalness: 0.55, roughness: 0.4 }, 12);
  canopy.position.y = 2.95;
  hangLamp.add(canopy);
  const lampShade = mesh(
    new THREE.ConeGeometry(0.48, 0.38, 16, 1, true),
    mat(0xf0d8a8, {
      emissive: COL.lamp,
      emissiveIntensity: 0.38,
      roughness: 0.55,
      side: THREE.DoubleSide,
    })
  );
  lampShade.position.y = 2.78;
  hangLamp.add(lampShade);
  // inner bulb glow
  const bulb = sphere(0.08, COL.lamp, {
    emissive: COL.lamp,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  }, 10, 8);
  bulb.position.y = 2.72;
  hangLamp.add(bulb);
  // bottom ring
  const shadeRing = mesh(
    new THREE.TorusGeometry(0.46, 0.015, 8, 20),
    mat(COL.brass, { metalness: 0.5, roughness: 0.4 })
  );
  shadeRing.position.y = 2.6;
  shadeRing.rotation.x = Math.PI / 2;
  hangLamp.add(shadeRing);
  house.add(hangLamp);

  // ——— Lights ———
  const lights = {};

  const ambient = new THREE.AmbientLight(0x3a4a5c, 0.42);
  scene.add(ambient);
  lights.ambient = ambient;

  const hemi = new THREE.HemisphereLight(0x6a88a8, 0x1a2218, 0.52);
  scene.add(hemi);
  lights.hemi = hemi;

  const moonDir = new THREE.DirectionalLight(0x99aacc, 0.42);
  moonDir.position.set(-20, 30, -10);
  moonDir.castShadow = true;
  moonDir.shadow.mapSize.set(2048, 2048);
  moonDir.shadow.camera.near = 1;
  moonDir.shadow.camera.far = 90;
  moonDir.shadow.camera.left = -35;
  moonDir.shadow.camera.right = 35;
  moonDir.shadow.camera.top = 35;
  moonDir.shadow.camera.bottom = -35;
  moonDir.shadow.bias = -0.0002;
  scene.add(moonDir);
  lights.moonDir = moonDir;

  // Cool exterior fill
  const exteriorCool = new THREE.DirectionalLight(0x5577aa, 0.18);
  exteriorCool.position.set(15, 10, 20);
  scene.add(exteriorCool);
  lights.exteriorCool = exteriorCool;

  const roomLamp = new THREE.PointLight(COL.lamp, 2.05, 14, 1.35);
  roomLamp.position.set(0, 2.55, -1.0);
  roomLamp.castShadow = true;
  roomLamp.shadow.mapSize.set(1024, 1024);
  roomLamp.shadow.bias = -0.0003;
  house.add(roomLamp);
  lights.roomLamp = roomLamp;

  const candleLight = new THREE.PointLight(COL.candle, 0.75, 6, 2);
  candleLight.position.set(3.2, 1.12, -2.8);
  house.add(candleLight);
  lights.candleLight = candleLight;

  const porchLight = new THREE.PointLight(0xffcc99, 0.62, 10, 2);
  porchLight.position.set(0, 2.5, 4.6);
  house.add(porchLight);
  lights.porchLight = porchLight;

  const warmFill = new THREE.PointLight(0xffb070, 0.55, 12);
  warmFill.position.set(0, 1.55, -0.5);
  house.add(warmFill);
  lights.warmFill = warmFill;

  // Soft window bounce lights (warm leaking out)
  for (const [wx, wy, wz] of [
    [-4.2, 1.85, -1.5],
    [4.2, 1.85, -1.5],
    [-1.8, 1.95, -4.2],
    [1.8, 1.95, -4.2],
  ]) {
    const wl = new THREE.PointLight(COL.windowGlow, 0.22, 4, 2);
    wl.position.set(wx, wy, wz);
    house.add(wl);
  }

  lights.deskLamp = deskLampLight;

  // Store base light intensities for nightPhase restores
  const lightBases = {
    ambient: ambient.intensity,
    hemi: hemi.intensity,
    moonDir: moonDir.intensity,
    exteriorCool: exteriorCool.intensity,
    roomLamp: roomLamp.intensity,
    candleLight: candleLight.intensity,
    porchLight: porchLight.intensity,
    warmFill: warmFill.intensity,
    deskLamp: deskLampLight ? deskLampLight.intensity : 0.5,
  };

  // ——— Phase props: open treatise on table for Night 1 debate ———
  const phaseProps = new THREE.Group();
  phaseProps.name = 'phaseProps';
  house.add(phaseProps);

  const night1Props = new THREE.Group();
  night1Props.name = 'night1Props';
  night1Props.visible = false;
  // Open book on low table (between chairs)
  const openBookBase = box(0.42, 0.02, 0.28, 0x3a2818, { roughness: 0.85 });
  openBookBase.position.set(0.15, 0.62, -1.15);
  night1Props.add(openBookBase);
  const pageL = box(0.18, 0.008, 0.24, 0xf2e8d4, { roughness: 0.95 });
  pageL.position.set(0.05, 0.635, -1.15);
  pageL.rotation.z = 0.08;
  night1Props.add(pageL);
  const pageR = box(0.18, 0.008, 0.24, 0xefe4cc, { roughness: 0.95 });
  pageR.position.set(0.25, 0.635, -1.15);
  pageR.rotation.z = -0.1;
  night1Props.add(pageR);
  // Small ink note / argument scrap
  const scrap = box(0.14, 0.005, 0.1, 0xe8dcc4, { roughness: 0.9 });
  scrap.position.set(-0.35, 0.62, -1.0);
  scrap.rotation.y = 0.35;
  night1Props.add(scrap);
  phaseProps.add(night1Props);

  // Night 2: interpersonal debate props — closed book stack + second cup used + string diagram metaphor (thread spool)
  const night2Props = new THREE.Group();
  night2Props.name = 'night2Props';
  night2Props.visible = false;
  const bookStack = box(0.28, 0.06, 0.2, 0x4a3030, { roughness: 0.8 });
  bookStack.position.set(-0.4, 0.64, -1.2);
  night2Props.add(bookStack);
  const bookStack2 = box(0.26, 0.05, 0.18, 0x2a3a4a, { roughness: 0.8 });
  bookStack2.position.set(-0.38, 0.7, -1.18);
  bookStack2.rotation.y = 0.12;
  night2Props.add(bookStack2);
  // Extra teacup (relationship / facing the other)
  const cup2 = mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.06, 10),
    mat(0xc8b8a0, { roughness: 0.45 })
  );
  cup2.position.set(0.22, 0.61, -1.05);
  night2Props.add(cup2);
  // Small wooden figure pair (two people facing) — interpersonal motif
  const figA = mesh(new THREE.CapsuleGeometry(0.035, 0.08, 3, 6), mat(0x6a5040));
  figA.position.set(0.05, 0.68, -1.35);
  night2Props.add(figA);
  const figB = mesh(new THREE.CapsuleGeometry(0.035, 0.08, 3, 6), mat(0x405060));
  figB.position.set(0.16, 0.68, -1.32);
  night2Props.add(figB);
  // Thin "thread" between figures (relationship line)
  const thread = box(0.12, 0.008, 0.008, 0xc4a070, { roughness: 0.6 });
  thread.position.set(0.105, 0.72, -1.335);
  night2Props.add(thread);
  // Lamp dimmer scrap map of "comparison"
  const slate = box(0.2, 0.01, 0.14, 0x2a2820, { roughness: 0.9 });
  slate.position.set(0.45, 0.62, -1.35);
  night2Props.add(slate);
  phaseProps.add(night2Props);

  // Night 3: task separation — two small trays / task stones (mine vs yours)
  const night3Props = new THREE.Group();
  night3Props.name = 'night3Props';
  night3Props.visible = false;
  const trayMine = box(0.22, 0.02, 0.16, 0x5a4030, { roughness: 0.75 });
  trayMine.position.set(-0.25, 0.62, -1.15);
  night3Props.add(trayMine);
  const trayYours = box(0.22, 0.02, 0.16, 0x3a4050, { roughness: 0.75 });
  trayYours.position.set(0.28, 0.62, -1.12);
  night3Props.add(trayYours);
  const pebbleA = mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(0x8a7a60));
  pebbleA.position.set(-0.25, 0.66, -1.15);
  night3Props.add(pebbleA);
  const pebbleB = mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(0x607080));
  pebbleB.position.set(0.28, 0.66, -1.12);
  night3Props.add(pebbleB);
  const divideLine = box(0.02, 0.01, 0.35, 0xc4a878, { roughness: 0.5 });
  divideLine.position.set(0.02, 0.615, -1.2);
  night3Props.add(divideLine);
  phaseProps.add(night3Props);

  // Night 4: community — circle of cups / warm cloth
  const night4Props = new THREE.Group();
  night4Props.name = 'night4Props';
  night4Props.visible = false;
  const cloth = mesh(new THREE.CircleGeometry(0.55, 20), mat(0x5a2a28, { roughness: 1 }));
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.set(0.05, 0.585, -1.2);
  night4Props.add(cloth);
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const c = mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.055, 8),
      mat(i % 2 === 0 ? 0xc8b8a0 : 0xb8a890, { roughness: 0.45 })
    );
    c.position.set(Math.cos(ang) * 0.28, 0.62, -1.2 + Math.sin(ang) * 0.22);
    night4Props.add(c);
  }
  phaseProps.add(night4Props);

  // Night 5 / pre-ending: hourglass-ish / single candle focus + window notes closed
  const night5Props = new THREE.Group();
  night5Props.name = 'night5Props';
  night5Props.visible = false;
  const hourGlass = mesh(
    new THREE.ConeGeometry(0.06, 0.12, 8),
    mat(0xa09080, { roughness: 0.4, transparent: true, opacity: 0.85 })
  );
  hourGlass.position.set(0.35, 0.7, -1.05);
  night5Props.add(hourGlass);
  const hourGlass2 = mesh(
    new THREE.ConeGeometry(0.06, 0.12, 8),
    mat(0xa09080, { roughness: 0.4, transparent: true, opacity: 0.85 })
  );
  hourGlass2.position.set(0.35, 0.58, -1.05);
  hourGlass2.rotation.x = Math.PI;
  night5Props.add(hourGlass2);
  const closedBook = box(0.3, 0.04, 0.2, 0x3a2a22, { roughness: 0.8 });
  closedBook.position.set(-0.3, 0.64, -1.25);
  night5Props.add(closedBook);
  phaseProps.add(night5Props);

  let currentNightPhase = 'prologue';

  /**
   * Atmosphere switch across book nights. Same house; lighting + props change.
   * @param {'prologue'|'night1'|'night2'|'night3'|'night4'|'night5'|'ending'} phase
   */
  function setNightPhase(phase) {
    currentNightPhase = phase || 'prologue';
    // defaults from prologue
    ambient.intensity = lightBases.ambient;
    hemi.intensity = lightBases.hemi;
    moonDir.intensity = lightBases.moonDir;
    exteriorCool.intensity = lightBases.exteriorCool;
    roomLamp.intensity = lightBases.roomLamp;
    candleLight.intensity = lightBases.candleLight;
    porchLight.intensity = lightBases.porchLight;
    warmFill.intensity = lightBases.warmFill;
    if (deskLampLight) deskLampLight.intensity = lightBases.deskLamp;
    lightBases.roomLamp = roomLamp.intensity;
    ambient.color.setHex(0x2a3848);
    hemi.color.setHex(0x5577a0);
    roomLamp.color.setHex(COL.lamp);
    night1Props.visible = false;
    night2Props.visible = false;
    night3Props.visible = false;
    night4Props.visible = false;
    night5Props.visible = false;
    setSnowMode(false);

    switch (currentNightPhase) {
      case 'night1':
        ambient.intensity = 0.34;
        hemi.intensity = 0.44;
        moonDir.intensity = 0.36;
        roomLamp.intensity = 1.85;
        candleLight.intensity = 0.95;
        warmFill.intensity = 0.65;
        if (deskLampLight) deskLampLight.intensity = 0.85;
        porchLight.intensity = 0.55;
        lightBases.roomLamp = 1.85;
        night1Props.visible = true;
        break;
      case 'night2':
        ambient.intensity = 0.32;
        ambient.color.setHex(0x2c3c50);
        hemi.intensity = 0.42;
        hemi.color.setHex(0x5a7a9a);
        moonDir.intensity = 0.4;
        exteriorCool.intensity = 0.2;
        roomLamp.intensity = 1.7;
        roomLamp.color.setHex(0xf0d0a0);
        candleLight.intensity = 0.9;
        warmFill.intensity = 0.48;
        if (deskLampLight) deskLampLight.intensity = 0.7;
        porchLight.intensity = 0.5;
        lightBases.roomLamp = 1.7;
        night2Props.visible = true;
        break;
      case 'night3':
        // Task separation — clearer candle, cooler edges
        ambient.intensity = 0.3;
        ambient.color.setHex(0x283848);
        hemi.intensity = 0.4;
        roomLamp.intensity = 1.7;
        candleLight.intensity = 1.15;
        warmFill.intensity = 0.55;
        if (deskLampLight) deskLampLight.intensity = 0.8;
        lightBases.roomLamp = 1.7;
        night3Props.visible = true;
        break;
      case 'night4':
        // Community warmth
        ambient.intensity = 0.36;
        ambient.color.setHex(0x3a3428);
        hemi.intensity = 0.46;
        hemi.color.setHex(0x8899aa);
        roomLamp.intensity = 2.0;
        roomLamp.color.setHex(0xffd0a0);
        candleLight.intensity = 0.85;
        warmFill.intensity = 0.72;
        porchLight.intensity = 0.55;
        lightBases.roomLamp = 2.0;
        night4Props.visible = true;
        break;
      case 'night5':
        // Deeper night, pre-dawn clarity
        ambient.intensity = 0.3;
        moonDir.intensity = 0.5;
        exteriorCool.intensity = 0.24;
        roomLamp.intensity = 1.55;
        candleLight.intensity = 1.0;
        warmFill.intensity = 0.5;
        lightBases.roomLamp = 1.55;
        night5Props.visible = true;
        break;
      case 'ending':
        ambient.intensity = 0.32;
        moonDir.intensity = 0.58;
        exteriorCool.intensity = 0.3;
        roomLamp.intensity = 1.15;
        warmFill.intensity = 0.35;
        porchLight.intensity = 0.7;
        lightBases.roomLamp = 1.15;
        night5Props.visible = true;
        setSnowMode(true);
        break;
      case 'prologue':
      default:
        lightBases.roomLamp = 2.05;
        roomLamp.intensity = 2.05;
        ambient.intensity = 0.42;
        hemi.intensity = 0.52;
        moonDir.intensity = 0.42;
        break;
    }
  }

  // ——— Snow particles (improved) ———
  const snowCount = 900;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(snowCount * 3);
  const snowVel = [];
  for (let i = 0; i < snowCount; i++) {
    snowPos[i * 3] = (rng() - 0.5) * 48;
    snowPos[i * 3 + 1] = rng() * 20;
    snowPos[i * 3 + 2] = (rng() - 0.5) * 48 + 8;
    snowVel.push({
      y: 0.35 + rng() * 0.9,
      x: (rng() - 0.5) * 0.35,
      z: (rng() - 0.5) * 0.35,
      phase: rng() * Math.PI * 2,
      wobble: 0.15 + rng() * 0.35,
    });
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({
    color: COL.snow,
    size: 0.07,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.visible = false;
  root.add(snow);

  // Second layer — larger, slower flakes
  const snowCount2 = 200;
  const snowGeo2 = new THREE.BufferGeometry();
  const snowPos2 = new Float32Array(snowCount2 * 3);
  const snowVel2 = [];
  for (let i = 0; i < snowCount2; i++) {
    snowPos2[i * 3] = (rng() - 0.5) * 40;
    snowPos2[i * 3 + 1] = rng() * 18;
    snowPos2[i * 3 + 2] = (rng() - 0.5) * 40 + 8;
    snowVel2.push({
      y: 0.2 + rng() * 0.4,
      x: (rng() - 0.5) * 0.2,
      z: (rng() - 0.5) * 0.2,
      phase: rng() * Math.PI * 2,
    });
  }
  snowGeo2.setAttribute('position', new THREE.BufferAttribute(snowPos2, 3));
  const snowMat2 = new THREE.PointsMaterial({
    color: 0xf0f4fa,
    size: 0.14,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const snow2 = new THREE.Points(snowGeo2, snowMat2);
  snow2.visible = false;
  root.add(snow2);

  // Snow ground accumulation
  const snowGround = mesh(
    new THREE.CircleGeometry(28, 48),
    mat(0xd0d8e4, { roughness: 1, transparent: true, opacity: 0 }),
    false,
    true
  );
  snowGround.rotation.x = -Math.PI / 2;
  snowGround.position.y = 0.045;
  snowGround.visible = false;
  root.add(snowGround);

  // Soft snow patches on path / near house
  const snowPatches = [];
  for (let i = 0; i < 8; i++) {
    const patch = mesh(
      new THREE.CircleGeometry(0.8 + rng() * 1.2, 12),
      mat(0xd8e0ec, { roughness: 1, transparent: true, opacity: 0 }),
      false,
      true
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((rng() - 0.5) * 6, 0.05, 4 + rng() * 16);
    patch.visible = false;
    root.add(patch);
    snowPatches.push(patch);
  }

  let snowMode = false;
  let snowAmount = 0;
  const baseFogDensity = 0.012;
  const baseBg = new THREE.Color(COL.nightSky);

  function setSnowMode(on, instant = false) {
    snowMode = !!on;
    if (instant) {
      snowAmount = on ? 1 : 0;
      applySnowVisuals();
    }
  }

  function applySnowVisuals() {
    snowMat.opacity = snowAmount * 0.88;
    snowMat2.opacity = snowAmount * 0.55;
    snow.visible = snowAmount > 0.01;
    snow2.visible = snowAmount > 0.01;
    snowGround.material.opacity = snowAmount * 0.58;
    snowGround.visible = snowAmount > 0.01;
    for (const p of snowPatches) {
      p.material.opacity = snowAmount * 0.7;
      p.visible = snowAmount > 0.01;
    }
    if (scene.fog) {
      scene.fog.density = baseFogDensity + snowAmount * 0.01;
    }
    if (snowAmount > 0.01) {
      scene.background.setRGB(
        baseBg.r + snowAmount * 0.04,
        baseBg.g + snowAmount * 0.05,
        baseBg.b + snowAmount * 0.06
      );
    } else {
      scene.background.copy(baseBg);
    }
  }

  function updateSnow(dt, t) {
    const target = snowMode ? 1 : 0;
    snowAmount += (target - snowAmount) * Math.min(1, dt * 0.55);
    applySnowVisuals();

    if (snowAmount > 0.01) {
      const pos = snow.geometry.attributes.position.array;
      for (let i = 0; i < snowCount; i++) {
        const v = snowVel[i];
        pos[i * 3] += (v.x + Math.sin(t * 0.001 + v.phase) * v.wobble * 0.15) * dt;
        pos[i * 3 + 1] -= v.y * dt;
        pos[i * 3 + 2] += (v.z + Math.cos(t * 0.0009 + v.phase) * v.wobble * 0.12) * dt;
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3 + 1] = 14 + Math.random() * 6;
          pos[i * 3] = (Math.random() - 0.5) * 48;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 48 + 8;
        }
      }
      snow.geometry.attributes.position.needsUpdate = true;

      const pos2 = snow2.geometry.attributes.position.array;
      for (let i = 0; i < snowCount2; i++) {
        const v = snowVel2[i];
        pos2[i * 3] += (v.x + Math.sin(t * 0.0007 + v.phase) * 0.08) * dt;
        pos2[i * 3 + 1] -= v.y * dt;
        pos2[i * 3 + 2] += v.z * dt;
        if (pos2[i * 3 + 1] < 0) {
          pos2[i * 3 + 1] = 12 + Math.random() * 6;
          pos2[i * 3] = (Math.random() - 0.5) * 40;
          pos2[i * 3 + 2] = (Math.random() - 0.5) * 40 + 8;
        }
      }
      snow2.geometry.attributes.position.needsUpdate = true;
    }

    // Candle flicker
    if (lights.candleLight) {
      const now = t || performance.now();
      lights.candleLight.intensity =
        0.5 +
        Math.sin(now * 0.012) * 0.12 +
        Math.sin(now * 0.037) * 0.09 +
        Math.sin(now * 0.061) * 0.05;
    }
    if (flame) {
      const now = t || performance.now();
      flame.scale.y = 1.25 + Math.sin(now * 0.02) * 0.28 + Math.sin(now * 0.051) * 0.12;
      flame.scale.x = 0.6 + Math.sin(now * 0.033) * 0.1;
      flame.scale.z = 0.6 + Math.cos(now * 0.029) * 0.1;
      flame.position.y = 1.12 + Math.sin(now * 0.04) * 0.01;
    }
    // subtle room lamp pulse around current phase base
    if (lights.roomLamp) {
      const base = lightBases.roomLamp || 1.7;
      lights.roomLamp.intensity = base + Math.sin((t || 0) * 0.0015) * 0.08;
    }
  }

  // ——— Dust motes (study) ———
  const moteCount = 70;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(moteCount * 3);
  const motePhase = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (rng() - 0.5) * 6.5;
    motePos[i * 3 + 1] = 0.4 + rng() * 2.4;
    motePos[i * 3 + 2] = -3.6 + rng() * 5.5;
    motePhase[i] = rng() * Math.PI * 2;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: 0xffddaa,
      size: 0.028,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  house.add(motes);

  function updateMotes(t) {
    const pos = motes.geometry.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      const ph = motePhase[i];
      pos[i * 3 + 1] += Math.sin(t * 0.001 + ph) * 0.0018;
      pos[i * 3] += Math.cos(t * 0.0008 + ph * 1.3) * 0.0012;
      pos[i * 3 + 2] += Math.sin(t * 0.0006 + ph * 0.7) * 0.0008;
      // soft wrap
      if (pos[i * 3 + 1] > 2.9) pos[i * 3 + 1] = 0.4;
      if (pos[i * 3 + 1] < 0.3) pos[i * 3 + 1] = 2.8;
    }
    motes.geometry.attributes.position.needsUpdate = true;
  }

  // Initialize atmosphere
  setNightPhase('prologue');

  return {
    root,
    house,
    anchors,
    lights,
    setSnowMode,
    setNightPhase,
    getNightPhase: () => currentNightPhase,
    update(dt, t) {
      updateSnow(dt, t);
      updateMotes(t);
    },
  };
}
