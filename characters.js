import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────────
 * Refined procedural humanoids — same public API as before.
 * export: createPhilosopher(), createYouth()
 * each: { root, head, state, setEmotion, setGesture, setSpeaking,
 *         setSeated, walkTo, stopWalk, update, lookAt }
 * ───────────────────────────────────────────────────────────── */

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.04,
    side: opts.side ?? THREE.FrontSide,
    flatShading: false,
  });
}

function cloth(color, roughness = 0.88) {
  return mat(color, { roughness, metalness: 0.02 });
}

function skinMat(color) {
  return mat(color, { roughness: 0.55, metalness: 0.0 });
}

function enableShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Soft sphere with default high segments */
function sphere(r, segs = 20) {
  return new THREE.SphereGeometry(r, segs, segs);
}

/** Capsule with higher radial resolution */
function capsule(r, len, capSegs = 6, radSegs = 10) {
  return new THREE.CapsuleGeometry(r, len, capSegs, radSegs);
}

/**
 * Build a hand: palm box + 4 finger capsules + thumb.
 */
function makeHand(skin, side = 1) {
  const g = new THREE.Group();
  const palm = enableShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.028), skin)
  );
  palm.position.y = -0.01;
  g.add(palm);

  const fingerGeo = capsule(0.008, 0.028, 3, 6);
  for (let i = 0; i < 4; i++) {
    const f = enableShadow(new THREE.Mesh(fingerGeo, skin));
    f.position.set((i - 1.5) * 0.014, -0.055, 0.002);
    f.rotation.x = 0.15;
    g.add(f);
  }

  const thumb = enableShadow(new THREE.Mesh(capsule(0.009, 0.02, 3, 6), skin));
  thumb.position.set(side * 0.032, -0.015, 0.008);
  thumb.rotation.z = side * 0.7;
  thumb.rotation.x = 0.4;
  g.add(thumb);

  return g;
}

/**
 * Layered eye: sclera + iris + pupil + subtle lid.
 */
function makeEye(skinColor, irisColor = 0x3a4a5a) {
  const g = new THREE.Group();

  const sclera = new THREE.Mesh(sphere(0.022, 12), mat(0xf2efe8, { roughness: 0.35 }));
  g.add(sclera);

  const iris = new THREE.Mesh(sphere(0.014, 12), mat(irisColor, { roughness: 0.4 }));
  iris.position.z = 0.012;
  iris.scale.set(1, 1, 0.55);
  g.add(iris);

  const pupil = new THREE.Mesh(sphere(0.007, 10), mat(0x0a0a0c, { roughness: 0.25 }));
  pupil.position.z = 0.018;
  pupil.scale.set(1, 1, 0.5);
  g.add(pupil);

  // soft highlight
  const hl = new THREE.Mesh(
    sphere(0.004, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  hl.position.set(0.005, 0.006, 0.022);
  g.add(hl);

  // upper eyelid (skin crescent via scaled sphere)
  const lid = new THREE.Mesh(
    sphere(0.023, 12),
    skinMat(skinColor)
  );
  lid.scale.set(1.05, 0.45, 0.85);
  lid.position.set(0, 0.012, 0.004);
  g.add(lid);

  return g;
}

/**
 * Config-driven refined humanoid.
 */
function createHumanoid(config) {
  const {
    skin = 0xd4b08c,
    hair = 0x2a2018,
    shirt = 0x3a4a5a,
    pants = 0x2a2a32,
    shoes = 0x1a1510,
    coat = 0x3a3a48,
    height = 1.0,
    style = 'youth', // 'elder' | 'youth'
    iris = 0x3a4a5a,
  } = config;

  const isElder = style === 'elder';
  const root = new THREE.Group();
  root.scale.setScalar(height);

  const skinM = skinMat(skin);
  const shirtM = cloth(shirt, 0.82);
  const pantsM = cloth(pants, 0.86);
  const shoeM = mat(shoes, { roughness: 0.9, metalness: 0.08 });
  const coatM = cloth(coat, 0.9);
  const hairM = mat(hair, { roughness: 0.95, metalness: 0.0 });
  const lipM = mat(isElder ? 0x9a6a5a : 0xb06858, { roughness: 0.55 });

  // ── Skeleton groups ──────────────────────────────────────
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.95;
  root.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.15;
  pelvis.add(torso);

  // ── Torso / clothing ─────────────────────────────────────
  // Inner shirt body
  const chest = enableShadow(
    new THREE.Mesh(capsule(0.20, 0.32, 6, 12), shirtM)
  );
  chest.position.y = 0.26;
  torso.add(chest);

  // Shoulders / upper chest bulk
  const shoulders = enableShadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), shirtM)
  );
  shoulders.position.y = 0.42;
  shoulders.scale.set(1.35, 0.55, 0.85);
  torso.add(shoulders);

  // Collar
  const collar = enableShadow(
    new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 16, Math.PI), shirtM)
  );
  collar.position.set(0, 0.5, 0.02);
  collar.rotation.x = Math.PI / 2 + 0.15;
  collar.rotation.z = Math.PI;
  torso.add(collar);

  if (isElder) {
    // Long scholarly robe / kimono-like coat
    const robe = enableShadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.42, 1.05, 14, 1, true),
        mat(coat, { roughness: 0.92, side: THREE.DoubleSide })
      )
    );
    robe.position.y = 0.05;
    pelvis.add(robe);

    // Robe front panels (open edges)
    const panelGeo = new THREE.BoxGeometry(0.16, 0.95, 0.02);
    const panelL = enableShadow(new THREE.Mesh(panelGeo, coatM));
    panelL.position.set(-0.1, 0.08, 0.18);
    panelL.rotation.y = 0.18;
    pelvis.add(panelL);
    const panelR = enableShadow(new THREE.Mesh(panelGeo, coatM));
    panelR.position.set(0.1, 0.08, 0.18);
    panelR.rotation.y = -0.18;
    pelvis.add(panelR);

    // Sash / belt
    const sash = enableShadow(
      new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 8, 20), cloth(0x2a2430, 0.85))
    );
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.12;
    sash.scale.set(1, 1, 0.55);
    pelvis.add(sash);

    // Sash knot
    const knot = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), cloth(0x2a2430, 0.85))
    );
    knot.position.set(0, 0.12, 0.22);
    pelvis.add(knot);

    // Inner shirt visible at neck
    const innerShirt = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), cloth(0xc8c0b0, 0.8))
    );
    innerShirt.position.set(0, 0.48, 0.12);
    torso.add(innerShirt);
  } else {
    // Modern open jacket / cardigan over shirt
    const jacketBody = enableShadow(
      new THREE.Mesh(capsule(0.22, 0.28, 6, 12), coatM)
    );
    jacketBody.position.y = 0.24;
    jacketBody.scale.set(1.08, 1, 1.05);
    torso.add(jacketBody);

    // Open front edges
    const edgeGeo = new THREE.BoxGeometry(0.04, 0.42, 0.02);
    const edgeL = enableShadow(new THREE.Mesh(edgeGeo, coatM));
    edgeL.position.set(-0.08, 0.22, 0.2);
    edgeL.rotation.y = 0.25;
    torso.add(edgeL);
    const edgeR = enableShadow(new THREE.Mesh(edgeGeo, coatM));
    edgeR.position.set(0.08, 0.22, 0.2);
    edgeR.rotation.y = -0.25;
    torso.add(edgeR);

    // Shirt placket visible in opening
    const placket = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.03), shirtM)
    );
    placket.position.set(0, 0.22, 0.18);
    torso.add(placket);

    // Jacket hem
    const hem = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.28), coatM)
    );
    hem.position.set(0, 0.02, 0.02);
    torso.add(hem);
  }

  // ── Neck ─────────────────────────────────────────────────
  const neck = enableShadow(new THREE.Mesh(capsule(0.055, 0.08, 4, 10), skinM));
  neck.position.y = 0.54;
  torso.add(neck);

  // ── Head ─────────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.y = 0.68;
  torso.add(head);

  // Skull — slightly elongated for elder, more angular for youth
  const skull = enableShadow(new THREE.Mesh(sphere(0.155, 22), skinM));
  if (isElder) {
    skull.scale.set(1.0, 1.05, 0.98);
  } else {
    skull.scale.set(0.98, 1.02, 1.0);
  }
  head.add(skull);

  // Jaw / chin
  const jaw = enableShadow(new THREE.Mesh(sphere(0.09, 16), skinM));
  jaw.position.set(0, -0.1, 0.02);
  jaw.scale.set(isElder ? 0.95 : 0.88, 0.7, 0.85);
  head.add(jaw);

  // Chin tip
  const chin = enableShadow(new THREE.Mesh(sphere(0.035, 12), skinM));
  chin.position.set(0, -0.145, 0.08);
  chin.scale.set(1.1, 0.7, 0.9);
  head.add(chin);

  // Cheekbones (stronger on youth)
  if (!isElder) {
    const cheekL = enableShadow(new THREE.Mesh(sphere(0.04, 12), skinM));
    cheekL.position.set(-0.1, -0.02, 0.08);
    cheekL.scale.set(0.7, 0.6, 0.6);
    head.add(cheekL);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.1;
    head.add(cheekR);
  }

  // Nose
  const noseBridge = enableShadow(new THREE.Mesh(capsule(0.015, 0.04, 3, 8), skinM));
  noseBridge.position.set(0, 0.0, 0.145);
  noseBridge.rotation.x = 0.35;
  head.add(noseBridge);
  const noseTip = enableShadow(new THREE.Mesh(sphere(0.018, 12), skinM));
  noseTip.position.set(0, -0.03, 0.165);
  noseTip.scale.set(1.1, 0.85, 1.0);
  head.add(noseTip);

  // Ears
  function makeEar(side) {
    const ear = enableShadow(new THREE.Mesh(sphere(0.035, 12), skinM));
    ear.position.set(side * 0.155, 0.0, 0.0);
    ear.scale.set(0.45, 0.85, 0.55);
    ear.rotation.z = side * -0.15;
    head.add(ear);
    // earlobe
    const lobe = enableShadow(new THREE.Mesh(sphere(0.018, 10), skinM));
    lobe.position.set(side * 0.155, -0.03, 0.0);
    lobe.scale.set(0.5, 0.7, 0.5);
    head.add(lobe);
  }
  makeEar(-1);
  makeEar(1);

  // Eyes
  const eyeL = makeEye(skin, iris);
  eyeL.position.set(-0.052, 0.025, 0.13);
  head.add(eyeL);
  const eyeR = makeEye(skin, iris);
  eyeR.position.set(0.052, 0.025, 0.13);
  head.add(eyeR);

  // Brows
  const browMat = mat(isElder ? 0xb0a898 : hair, { roughness: 0.95 });
  const browGeo = new THREE.BoxGeometry(0.065, 0.012, 0.018);
  const browL = enableShadow(new THREE.Mesh(browGeo, browMat));
  browL.position.set(-0.055, 0.06, 0.14);
  head.add(browL);
  const browR = enableShadow(new THREE.Mesh(browGeo, browMat));
  browR.position.set(0.055, 0.06, 0.14);
  head.add(browR);

  // Mouth with lips
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.055, 0.14);
  head.add(mouthGroup);

  const upperLip = enableShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.018), lipM)
  );
  upperLip.position.y = 0.006;
  upperLip.scale.set(1, 1, 0.9);
  mouthGroup.add(upperLip);

  const lowerLip = enableShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.018), lipM)
  );
  lowerLip.position.y = -0.008;
  mouthGroup.add(lowerLip);

  // Mouth opening (dark) for speaking
  const mouthOpen = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.02, 0.012),
    mat(0x2a1512, { roughness: 0.9 })
  );
  mouthOpen.position.set(0, -0.001, 0.002);
  mouthOpen.scale.y = 0.05;
  mouthGroup.add(mouthOpen);

  // ── Hair ─────────────────────────────────────────────────
  if (isElder) {
    // Balding crown — shiny scalp is the skull itself
    // Side hair tufts
    const sideHairGeo = sphere(0.09, 16);
    const sideL = enableShadow(new THREE.Mesh(sideHairGeo, hairM));
    sideL.position.set(-0.12, 0.02, -0.02);
    sideL.scale.set(0.65, 1.05, 1.15);
    head.add(sideL);
    const sideR = enableShadow(new THREE.Mesh(sideHairGeo, hairM));
    sideR.position.set(0.12, 0.02, -0.02);
    sideR.scale.set(0.65, 1.05, 1.15);
    head.add(sideR);

    // Back hair ring
    const backHair = enableShadow(new THREE.Mesh(sphere(0.14, 16), hairM));
    backHair.position.set(0, 0.02, -0.08);
    backHair.scale.set(1.05, 0.85, 0.7);
    head.add(backHair);

    // Thin fringe / temples
    const templeL = enableShadow(new THREE.Mesh(sphere(0.045, 12), hairM));
    templeL.position.set(-0.12, 0.05, 0.08);
    templeL.scale.set(0.5, 0.7, 0.6);
    head.add(templeL);
    const templeR = templeL.clone();
    templeR.position.x = 0.12;
    head.add(templeR);

    // Fuller beard
    const beardMain = enableShadow(new THREE.Mesh(sphere(0.11, 16), hairM));
    beardMain.position.set(0, -0.12, 0.08);
    beardMain.scale.set(0.95, 0.95, 0.75);
    head.add(beardMain);

    const beardChin = enableShadow(new THREE.Mesh(sphere(0.07, 14), hairM));
    beardChin.position.set(0, -0.17, 0.06);
    beardChin.scale.set(0.85, 0.9, 0.7);
    head.add(beardChin);

    // Mustache
    const stache = enableShadow(new THREE.Mesh(sphere(0.05, 12), hairM));
    stache.position.set(0, -0.05, 0.14);
    stache.scale.set(1.4, 0.4, 0.55);
    head.add(stache);

    // Sideburns into beard
    const burnL = enableShadow(new THREE.Mesh(sphere(0.04, 12), hairM));
    burnL.position.set(-0.12, -0.06, 0.05);
    burnL.scale.set(0.45, 1.1, 0.6);
    head.add(burnL);
    const burnR = burnL.clone();
    burnR.position.x = 0.12;
    head.add(burnR);

    // Reading glasses
    const glassFrame = mat(0x2a2a30, { roughness: 0.4, metalness: 0.35 });
    const glassLens = new THREE.MeshBasicMaterial({
      color: 0xa8c8e0,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const rimL = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 6, 16), glassFrame);
    rimL.position.set(-0.05, 0.022, 0.155);
    head.add(rimL);
    const rimR = rimL.clone();
    rimR.position.x = 0.05;
    head.add(rimR);

    const lensL = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glassLens);
    lensL.position.set(-0.05, 0.022, 0.156);
    head.add(lensL);
    const lensR = lensL.clone();
    lensR.position.x = 0.05;
    head.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), glassFrame);
    bridge.position.set(0, 0.025, 0.155);
    head.add(bridge);

    // Temple arms
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.005), glassFrame);
    armL.position.set(-0.1, 0.022, 0.1);
    armL.rotation.y = 0.35;
    head.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.1;
    armR.rotation.y = -0.35;
    head.add(armR);
  } else {
    // Messy layered dark hair for youth
    const baseHair = enableShadow(new THREE.Mesh(sphere(0.17, 20), hairM));
    baseHair.position.set(0, 0.06, -0.01);
    baseHair.scale.set(1.08, 0.95, 1.1);
    head.add(baseHair);

    // Layered tufts
    const tuftPositions = [
      [0, 0.16, 0.02, 0.08, 1.2, 0.9, 1.0],
      [-0.08, 0.14, 0.06, 0.07, 1.0, 0.9, 1.1],
      [0.08, 0.14, 0.06, 0.07, 1.0, 0.9, 1.1],
      [-0.1, 0.1, -0.05, 0.075, 0.9, 1.0, 1.0],
      [0.1, 0.1, -0.05, 0.075, 0.9, 1.0, 1.0],
      [0, 0.12, -0.1, 0.09, 1.1, 0.8, 0.9],
      [-0.06, 0.08, 0.12, 0.05, 1.2, 0.7, 0.8],
      [0.05, 0.09, 0.11, 0.05, 1.0, 0.75, 0.85],
    ];
    for (const [x, y, z, r, sx, sy, sz] of tuftPositions) {
      const t = enableShadow(new THREE.Mesh(sphere(r, 12), hairM));
      t.position.set(x, y, z);
      t.scale.set(sx, sy, sz);
      head.add(t);
    }

    // Side bangs over forehead
    const bangL = enableShadow(new THREE.Mesh(sphere(0.05, 12), hairM));
    bangL.position.set(-0.07, 0.08, 0.12);
    bangL.scale.set(0.9, 0.8, 0.55);
    bangL.rotation.z = 0.3;
    head.add(bangL);
    const bangR = enableShadow(new THREE.Mesh(sphere(0.045, 12), hairM));
    bangR.position.set(0.06, 0.09, 0.12);
    bangR.scale.set(0.85, 0.7, 0.5);
    bangR.rotation.z = -0.25;
    head.add(bangR);
  }

  // ── Speaking halo ────────────────────────────────────────
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.22, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffcc88,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.28;
  head.add(halo);

  // Soft glow disc under ring
  const haloGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffe0a0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  haloGlow.rotation.x = -Math.PI / 2;
  haloGlow.position.y = 0.275;
  head.add(haloGlow);

  // ── Arms ─────────────────────────────────────────────────
  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.30, 0.42, 0);
    torso.add(arm);

    // Upper arm — coat/shirt sleeve
    const sleeveMat = isElder ? coatM : coatM;
    const upper = enableShadow(
      new THREE.Mesh(capsule(0.055, 0.26, 5, 10), sleeveMat)
    );
    upper.position.y = -0.16;
    arm.add(upper);

    // Sleeve cuff
    const cuff = enableShadow(
      new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 6, 12), sleeveMat)
    );
    cuff.position.y = -0.32;
    cuff.rotation.x = Math.PI / 2;
    arm.add(cuff);

    const forearm = new THREE.Group();
    forearm.position.y = -0.36;
    arm.add(forearm);

    // Forearm — skin for youth (rolled sleeve), coat for elder
    const lowerMat = isElder ? coatM : skinM;
    const lower = enableShadow(
      new THREE.Mesh(capsule(0.042, 0.22, 5, 10), lowerMat)
    );
    lower.position.y = -0.14;
    forearm.add(lower);

    if (!isElder) {
      // Shirt cuff peeking under jacket sleeve
      const shirtCuff = enableShadow(
        new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 5, 10), shirtM)
      );
      shirtCuff.position.y = -0.02;
      shirtCuff.rotation.x = Math.PI / 2;
      forearm.add(shirtCuff);
    }

    const hand = makeHand(skinM, side);
    hand.position.y = -0.30;
    forearm.add(hand);

    return { arm, forearm, hand, upper, lower };
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // ── Legs ─────────────────────────────────────────────────
  function makeLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0, 0);
    root.add(leg);

    const thigh = enableShadow(
      new THREE.Mesh(capsule(0.068, 0.30, 5, 10), pantsM)
    );
    thigh.position.y = 0.72;
    leg.add(thigh);

    const shin = new THREE.Group();
    shin.position.y = 0.52;
    leg.add(shin);

    const shinMesh = enableShadow(
      new THREE.Mesh(capsule(0.052, 0.28, 5, 10), pantsM)
    );
    shinMesh.position.y = -0.17;
    shin.add(shinMesh);

    // Shoe
    const foot = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.2), shoeM)
    );
    foot.position.set(0, -0.36, 0.035);
    shin.add(foot);

    // Sole
    const sole = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.2), mat(0x0e0c0a, { roughness: 0.95 }))
    );
    sole.position.set(0, -0.39, 0.035);
    shin.add(sole);

    return { leg, shin, thigh, shinMesh, foot };
  }

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // ── State ────────────────────────────────────────────────
  const state = {
    gesture: 'idle',
    emotion: 'calm',
    speaking: false,
    seated: true,
    walkPhase: 0,
    targetPos: new THREE.Vector3(),
    walking: false,
  };

  // Brow base positions for emotion reset
  const browBaseY = 0.06;
  const mouthBaseY = -0.055;

  function applySeatedPose() {
    leftLeg.leg.rotation.x = -Math.PI / 2.1;
    rightLeg.leg.rotation.x = -Math.PI / 2.1;
    leftLeg.shin.rotation.x = Math.PI / 2.2;
    rightLeg.shin.rotation.x = Math.PI / 2.2;
    pelvis.position.y = 0.55;
    // Youth slouch slightly when seated
    if (isElder) {
      torso.rotation.x = 0.02;
      leftArm.arm.rotation.x = -0.35;
      rightArm.arm.rotation.x = -0.35;
      leftArm.arm.rotation.z = 0.22;
      rightArm.arm.rotation.z = -0.22;
    } else {
      torso.rotation.x = 0.12;
      leftArm.arm.rotation.x = -0.5;
      rightArm.arm.rotation.x = -0.45;
      leftArm.arm.rotation.z = 0.3;
      rightArm.arm.rotation.z = -0.28;
    }
  }

  function applyStandingPose() {
    leftLeg.leg.rotation.x = 0;
    rightLeg.leg.rotation.x = 0;
    leftLeg.shin.rotation.x = 0;
    rightLeg.shin.rotation.x = 0;
    pelvis.position.y = 0.95;
    torso.rotation.x = isElder ? -0.02 : 0.04; // elder refined upright, youth slight slouch
    leftArm.arm.rotation.z = 0.12;
    rightArm.arm.rotation.z = -0.12;
    leftArm.arm.rotation.x = 0.05;
    rightArm.arm.rotation.x = 0.05;
  }

  applySeatedPose();

  const tmp = {
    mouthOpen: 0,
    headTiltX: 0,
    headTiltY: 0,
    headTiltZ: 0,
  };

  function setEmotion(emotion) {
    state.emotion = emotion || 'calm';

    // Reset brows
    browL.rotation.z = 0;
    browR.rotation.z = 0;
    browL.position.y = browBaseY;
    browR.position.y = browBaseY;
    browL.rotation.x = 0;
    browR.rotation.x = 0;

    // Reset lips somewhat
    upperLip.scale.set(1, 1, 0.9);
    lowerLip.scale.set(1, 1, 1);
    upperLip.position.y = 0.006;
    lowerLip.position.y = -0.008;

    switch (state.emotion) {
      case 'angry':
        browL.rotation.z = 0.32;
        browR.rotation.z = -0.32;
        browL.position.y = browBaseY - 0.012;
        browR.position.y = browBaseY - 0.012;
        upperLip.position.y = 0.004;
        lowerLip.position.y = -0.012;
        lowerLip.scale.set(0.9, 1.1, 1);
        tmp.headTiltX = 0.08;
        tmp.headTiltZ = 0;
        break;
      case 'tense':
        browL.rotation.z = 0.14;
        browR.rotation.z = -0.14;
        browL.position.y = browBaseY - 0.004;
        browR.position.y = browBaseY - 0.004;
        upperLip.scale.set(0.95, 0.9, 0.9);
        lowerLip.scale.set(0.95, 0.9, 1);
        tmp.headTiltX = 0.04;
        tmp.headTiltZ = 0;
        break;
      case 'thoughtful':
        browL.rotation.z = -0.1;
        browR.rotation.z = 0.06;
        browL.position.y = browBaseY + 0.008;
        browR.position.y = browBaseY + 0.002;
        browL.rotation.x = -0.05;
        upperLip.position.y = 0.005;
        lowerLip.position.y = -0.006;
        tmp.headTiltX = -0.12;
        tmp.headTiltZ = 0.08;
        break;
      case 'hopeful':
        browL.rotation.z = -0.12;
        browR.rotation.z = 0.12;
        browL.position.y = browBaseY + 0.01;
        browR.position.y = browBaseY + 0.01;
        upperLip.scale.set(1.05, 1.0, 0.9);
        lowerLip.scale.set(1.08, 1.15, 1);
        lowerLip.position.y = -0.01;
        tmp.headTiltX = -0.06;
        tmp.headTiltZ = 0;
        break;
      default: // calm
        tmp.headTiltX = isElder ? -0.03 : 0;
        tmp.headTiltZ = 0;
        break;
    }
  }

  function setGesture(gesture) {
    state.gesture = gesture || 'idle';
  }

  function setSpeaking(on) {
    state.speaking = !!on;
  }

  function setSeated(on) {
    state.seated = !!on;
    if (on) applySeatedPose();
    else applyStandingPose();
  }

  function walkTo(x, z, faceY = null) {
    state.walking = true;
    state.seated = false;
    applyStandingPose();
    state.targetPos.set(x, 0, z);
    if (faceY !== null) root.rotation.y = faceY;
  }

  function stopWalk() {
    state.walking = false;
  }

  function update(dt, t) {
    // Breathing
    const breathe = Math.sin(t * 0.002) * 0.012;
    torso.position.y = 0.15 + breathe;
    chest.scale.y = 1 + breathe * 0.45;
    shoulders.scale.y = 0.55 + breathe * 0.15;

    // Head idle + emotion tilt
    let headX = tmp.headTiltX;
    let headY = 0;
    let headZ = tmp.headTiltZ;

    if (state.emotion === 'thoughtful') {
      headY = Math.sin(t * 0.001) * 0.05;
    } else if (state.emotion === 'angry') {
      headX = 0.08 + Math.sin(t * 0.004) * 0.015;
    } else if (state.emotion === 'tense') {
      headY = Math.sin(t * 0.0035) * 0.07;
      headX = 0.04 + Math.sin(t * 0.005) * 0.02;
    } else if (state.emotion === 'hopeful') {
      headY = Math.sin(t * 0.0012) * 0.04;
    } else {
      headY = Math.sin(t * 0.0008) * 0.05;
    }

    // Youth: slightly more restless micro-motion
    if (!isElder && !state.walking) {
      headY += Math.sin(t * 0.0027) * 0.02;
    }

    head.rotation.x += (headX - head.rotation.x) * 0.08;
    head.rotation.y += (headY - head.rotation.y) * 0.08;
    head.rotation.z += (headZ - head.rotation.z) * 0.08;

    // Speaking mouth + halo
    const mouthTarget = state.speaking
      ? 0.45 + Math.abs(Math.sin(t * 0.015)) * 0.55
      : 0;
    tmp.mouthOpen += (mouthTarget - tmp.mouthOpen) * 0.22;

    mouthOpen.scale.y = 0.05 + tmp.mouthOpen * 1.8;
    lowerLip.position.y = -0.008 - tmp.mouthOpen * 0.012;
    upperLip.position.y = 0.006 + tmp.mouthOpen * 0.004;
    mouthGroup.position.y = mouthBaseY - tmp.mouthOpen * 0.004;

    const haloTarget = state.speaking ? 0.7 : 0;
    halo.material.opacity += (haloTarget - halo.material.opacity) * 0.12;
    haloGlow.material.opacity += ((state.speaking ? 0.22 : 0) - haloGlow.material.opacity) * 0.1;
    if (state.speaking) {
      halo.rotation.z = t * 0.002;
      const pulse = 1 + Math.sin(t * 0.006) * 0.08;
      halo.scale.setScalar(pulse);
      haloGlow.scale.setScalar(pulse * 0.95);
    }

    // Gestures
    const seated = state.seated && !state.walking;
    let armX = seated ? (isElder ? -0.35 : -0.45) : 0.08;
    let armZ = seated ? -0.22 : -0.12;
    let forearmX = 0;
    let armLX = seated ? (isElder ? -0.35 : -0.5) : 0.08;
    let armLZ = seated ? 0.22 : 0.12;
    let forearmLX = 0;
    let torsoXTarget = seated ? (isElder ? 0.02 : 0.12) : (isElder ? -0.02 : 0.04);

    switch (state.gesture) {
      case 'open':
      case 'welcome':
        armX = -0.15;
        armZ = -0.95;
        forearmX = -0.25;
        armLX = -0.15;
        armLZ = 0.95;
        forearmLX = -0.25;
        break;
      case 'point':
        armX = -1.25;
        armZ = -0.25;
        forearmX = -0.35;
        break;
      case 'think':
        armX = -1.55;
        armZ = 0.25;
        forearmX = -1.45;
        head.rotation.x = 0.18;
        break;
      case 'gesture':
        armX = -0.55 + Math.sin(t * 0.005) * 0.28;
        armZ = -0.55;
        forearmX = -0.45 + Math.sin(t * 0.006) * 0.22;
        break;
      case 'clench':
        armX = -0.85;
        armZ = -0.38;
        forearmX = -1.05;
        armLX = -0.85;
        armLZ = 0.38;
        forearmLX = -1.05;
        break;
      case 'lean':
        torsoXTarget = 0.18;
        armX = -0.55;
        armZ = -0.3;
        forearmX = -0.2;
        break;
      default:
        break;
    }

    torso.rotation.x += (torsoXTarget - torso.rotation.x) * 0.08;

    rightArm.arm.rotation.x += (armX - rightArm.arm.rotation.x) * 0.1;
    rightArm.arm.rotation.z += (armZ - rightArm.arm.rotation.z) * 0.1;
    rightArm.forearm.rotation.x += (forearmX - rightArm.forearm.rotation.x) * 0.1;
    leftArm.arm.rotation.x += (armLX - leftArm.arm.rotation.x) * 0.1;
    leftArm.arm.rotation.z += (armLZ - leftArm.arm.rotation.z) * 0.1;
    leftArm.forearm.rotation.x += (forearmLX - leftArm.forearm.rotation.x) * 0.1;

    // Walk cycle
    if (state.walking) {
      const pos = root.position;
      const dx = state.targetPos.x - pos.x;
      const dz = state.targetPos.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.08) {
        const speed = 1.4 * dt;
        pos.x += (dx / dist) * Math.min(speed, dist);
        pos.z += (dz / dist) * Math.min(speed, dist);
        root.rotation.y = Math.atan2(dx, dz);
        state.walkPhase += dt * 8;
        const swing = Math.sin(state.walkPhase) * 0.45;
        const knee = Math.max(0, Math.sin(state.walkPhase)) * 0.35;
        leftLeg.leg.rotation.x = swing;
        rightLeg.leg.rotation.x = -swing;
        leftLeg.shin.rotation.x = swing > 0 ? knee : 0;
        rightLeg.shin.rotation.x = swing < 0 ? Math.max(0, Math.sin(-state.walkPhase)) * 0.35 : 0;
        leftArm.arm.rotation.x = -swing * 0.55;
        rightArm.arm.rotation.x = swing * 0.55;
        pelvis.position.y = 0.95 + Math.abs(Math.sin(state.walkPhase * 2)) * 0.03;
      } else {
        state.walking = false;
        leftLeg.leg.rotation.x = 0;
        rightLeg.leg.rotation.x = 0;
        leftLeg.shin.rotation.x = 0;
        rightLeg.shin.rotation.x = 0;
      }
    }

    // Face target yaw (from lookAt)
    if (root.userData.faceTarget != null && !state.walking) {
      const ty = root.userData.faceTarget;
      let dy = ty - root.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      root.rotation.y += dy * 0.06;
    }
  }

  return {
    root,
    head,
    state,
    setEmotion,
    setGesture,
    setSpeaking,
    setSeated,
    walkTo,
    stopWalk,
    update,
    lookAt(x, y, z) {
      const dx = x - root.position.x;
      const dz = z - root.position.z;
      root.userData.faceTarget = Math.atan2(dx, dz);
    },
  };
}

export function createPhilosopher() {
  const p = createHumanoid({
    skin: 0xc9a882,
    hair: 0xb8b0a0,
    shirt: 0x2c3344,
    pants: 0x252530,
    shoes: 0x1a1510,
    coat: 0x3a4558,
    height: 1.02,
    style: 'elder',
    iris: 0x4a5a62,
  });
  p.root.name = 'philosopher';
  return p;
}

export function createYouth() {
  const y = createHumanoid({
    skin: 0xd4b08c,
    hair: 0x1a1510,
    shirt: 0x5a4038,
    pants: 0x2a2830,
    shoes: 0x1a1510,
    coat: 0x3a3848,
    height: 0.98,
    style: 'youth',
    iris: 0x3a4a58,
  });
  y.root.name = 'youth';
  return y;
}
