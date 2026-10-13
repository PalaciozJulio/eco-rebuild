import * as THREE from 'three';

export class Player {
  constructor(scene, camera, domElement, sound, world = null) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.sound = sound;
    this.world = world;

    // Movement parameters
    this.speed = 9.0;
    this.sprintMultiplier = 1.6;
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(0, 0.4, 0); // Spawns on workshop pad
    this.radius = 0.55; // Player collision radius
    this.isMoving = false;
    this.isSprinting = false;

    // Jumping & Gravity
    this.verticalVelocity = 0;
    this.gravity = -26;
    this.jumpForce = 11;
    this.isGrounded = true;

    // Third Person Camera Parameters
    this.camDistance = 8.5;
    this.camHeight = 3.6;
    this.camYaw = 0; // horizontal angle
    this.camPitch = 0.25; // vertical angle
    this.isMouseDown = false;
    this.previousMousePosition = { x: 0, y: 0 };

    // Input state
    this.keys = {
      w: false, a: false, s: false, d: false,
      shift: false, space: false
    };

    // Animation timers
    this.walkCycle = 0;
    this.stepTimer = 0;

    this.createMesh();
    this.setupControls();
  }

  setWorld(world) {
    this.world = world;
  }

  createMesh() {
    this.group = new THREE.Group();

    // 1. Torso / Suit
    const torsoGeo = new THREE.BoxGeometry(0.9, 1.2, 0.55);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.5
    });
    this.torso = new THREE.Mesh(torsoGeo, torsoMat);
    this.torso.position.y = 1.6;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Eco Vest Stripe (Neon Green)
    const vestStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.3, 0.58),
      new THREE.MeshStandardMaterial({
        color: 0x00e676,
        emissive: 0x00e676,
        emissiveIntensity: 0.5
      })
    );
    vestStripe.position.set(0, 1.6, 0);
    this.group.add(vestStripe);

    // 2. Head & Helmet / Cyber Visor
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.y = 2.5;
    this.head.castShadow = true;
    this.group.add(this.head);

    // Glowing cyan visor
    const visorGeo = new THREE.BoxGeometry(0.48, 0.18, 0.2);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.9
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.5, 0.25);
    this.group.add(visor);

    // 3. Recycler Backpack / Extractor Pack
    const packGeo = new THREE.BoxGeometry(0.65, 0.85, 0.45);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const backpack = new THREE.Mesh(packGeo, packMat);
    backpack.position.set(0, 1.65, -0.42);
    backpack.castShadow = true;
    this.group.add(backpack);

    // Backpack energy cell
    const cellGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.65, 12);
    const cellMat = new THREE.MeshStandardMaterial({
      color: 0x00e676,
      emissive: 0x00e676,
      emissiveIntensity: 0.7
    });
    const cell = new THREE.Mesh(cellGeo, cellMat);
    cell.position.set(0, 1.65, -0.66);
    this.group.add(cell);

    // 4. Limbs (Arms and Legs for procedural walk cycle)
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    
    // Left Arm
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), limbMat);
    this.leftArm.position.set(-0.62, 1.5, 0);
    this.group.add(this.leftArm);

    // Right Arm
    this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), limbMat);
    this.rightArm.position.set(0.62, 1.5, 0);
    this.group.add(this.rightArm);

    // Left Leg
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), limbMat);
    this.leftLeg.position.set(-0.25, 0.5, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);

    // Right Leg
    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), limbMat);
    this.rightLeg.position.set(0.25, 0.5, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);

    this.scene.add(this.group);
  }

  setupControls() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.keys.w = true;
      if (k === 's' || k === 'arrowdown') this.keys.s = true;
      if (k === 'a' || k === 'arrowleft') this.keys.a = true;
      if (k === 'd' || k === 'arrowright') this.keys.d = true;
      if (e.key === 'Shift') this.keys.shift = true;
      if (e.key === ' ' || e.code === 'Space') {
        this.keys.space = true;
        this.tryJump();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.keys.w = false;
      if (k === 's' || k === 'arrowdown') this.keys.s = false;
      if (k === 'a' || k === 'arrowleft') this.keys.a = false;
      if (k === 'd' || k === 'arrowright') this.keys.d = false;
      if (e.key === 'Shift') this.keys.shift = false;
      if (e.key === ' ' || e.code === 'Space') this.keys.space = false;
    });

    // Mouse drag orbital camera rotation
    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // left button
        this.isMouseDown = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      const sens = 0.005;
      this.camYaw -= deltaX * sens;
      this.camPitch = Math.max(-0.2, Math.min(1.1, this.camPitch + deltaY * sens));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // Mouse wheel zoom
    this.domElement.addEventListener('wheel', (e) => {
      this.camDistance = Math.max(4.5, Math.min(16, this.camDistance + e.deltaY * 0.005));
    }, { passive: true });
  }

  tryJump() {
    if (this.isGrounded) {
      this.verticalVelocity = this.jumpForce;
      this.isGrounded = false;
    }
  }

  resolveCollisions(targetPos) {
    if (!this.world || !this.world.colliders) return targetPos;

    const colliders = this.world.colliders;
    const res = { x: targetPos.x, z: targetPos.z };

    // Resolve push-out against obstacles
    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];

      if (col.type === 'circle') {
        const dx = res.x - col.x;
        const dz = res.z - col.z;
        const distSq = dx * dx + dz * dz;
        const minDist = this.radius + col.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.0001;
          const overlap = minDist - dist;
          // Push out along normal to allow smooth sliding around obstacle
          res.x += (dx / dist) * overlap;
          res.z += (dz / dist) * overlap;
        }
      } else if (col.type === 'box') {
        // AABB Box collision
        const closestX = Math.max(col.minX, Math.min(col.maxX, res.x));
        const closestZ = Math.max(col.minZ, Math.min(col.maxZ, res.z));
        const dx = res.x - closestX;
        const dz = res.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < this.radius * this.radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = this.radius - dist;
            res.x += (dx / dist) * overlap;
            res.z += (dz / dist) * overlap;
          } else {
            // Player is inside the box, push out to nearest edge
            const dLeft = Math.abs(res.x - col.minX);
            const dRight = Math.abs(res.x - col.maxX);
            const dTop = Math.abs(res.z - col.minZ);
            const dBottom = Math.abs(res.z - col.maxZ);
            const minEdge = Math.min(dLeft, dRight, dTop, dBottom);

            if (minEdge === dLeft) res.x = col.minX - this.radius;
            else if (minEdge === dRight) res.x = col.maxX + this.radius;
            else if (minEdge === dTop) res.z = col.minZ - this.radius;
            else res.z = col.maxZ + this.radius;
          }
        }
      }
    }

    return res;
  }

  update(dt) {
    // 1. Process movement input relative to camera yaw
    const forward = (this.keys.w ? 1 : 0) - (this.keys.s ? 1 : 0);
    const right = (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0);
    this.isMoving = forward !== 0 || right !== 0;
    this.isSprinting = this.isMoving && this.keys.shift;

    const currentSpeed = this.speed * (this.isSprinting ? this.sprintMultiplier : 1.0);

    if (this.isMoving) {
      // Camera forward direction (away from camera viewpoint into the scene)
      const forwardX = -Math.sin(this.camYaw);
      const forwardZ = -Math.cos(this.camYaw);

      // Camera right direction (perpendicular to forward on XZ plane)
      const rightX = Math.cos(this.camYaw);
      const rightZ = -Math.sin(this.camYaw);

      // Combine forward and right inputs
      let moveDirX = forwardX * forward + rightX * right;
      let moveDirZ = forwardZ * forward + rightZ * right;
      const len = Math.hypot(moveDirX, moveDirZ);

      if (len > 0.001) {
        moveDirX /= len;
        moveDirZ /= len;
      }

      this.velocity.x = moveDirX * currentSpeed;
      this.velocity.z = moveDirZ * currentSpeed;

      // Smooth rotate player to face move direction
      const targetRotation = Math.atan2(moveDirX, moveDirZ);
      let rotDiff = targetRotation - this.group.rotation.y;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      this.group.rotation.y += rotDiff * Math.min(1, dt * 14);

      // Auto-orient camera behind player towards movement heading (when not manually dragging mouse)
      if (!this.isMouseDown) {
        const idealCamYaw = targetRotation - Math.PI;
        let yawDiff = idealCamYaw - this.camYaw;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        this.camYaw += yawDiff * Math.min(1, dt * 2.6);
      }

      // Procedural limb animation
      this.walkCycle += dt * (this.isSprinting ? 18 : 11);
      const legSwing = Math.sin(this.walkCycle) * (this.isSprinting ? 0.7 : 0.45);
      const armSwing = -legSwing;

      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftArm.rotation.x = armSwing;
      this.rightArm.rotation.x = -armSwing;

      // Footstep sound
      this.stepTimer += dt * (this.isSprinting ? 1.6 : 1.0);
      if (this.stepTimer >= 0.38) {
        this.stepTimer = 0;
        if (this.isGrounded) {
          this.sound.playFootstep();
        }
      }
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
      // Reset limbs smoothly to idle
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
      this.stepTimer = 0;
    }

    // 2. Separate Axis Movement & Sliding Collision Resolution against Obstacles
    const proposedX = this.position.x + this.velocity.x * dt;
    const proposedZ = this.position.z + this.velocity.z * dt;

    // Test X motion with sliding
    const resolvedX = this.resolveCollisions({ x: proposedX, z: this.position.z });
    this.position.x = resolvedX.x;

    // Test Z motion with sliding
    const resolvedZ = this.resolveCollisions({ x: this.position.x, z: proposedZ });
    this.position.z = resolvedZ.z;

    // World bounds clamping
    const maxBound = 118;
    this.position.x = Math.max(-maxBound, Math.min(maxBound, this.position.x));
    this.position.z = Math.max(-maxBound, Math.min(maxBound, this.position.z));

    // 3. Terrain Height Adaptation & Mountain Climbing
    const groundY = this.world ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;

    if (this.isGrounded) {
      // Climb smoothly up and down mountains/hills
      this.position.y = groundY;
      this.verticalVelocity = 0;
    } else {
      // Free fall / jump
      this.verticalVelocity += this.gravity * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    }

    this.group.position.copy(this.position);

    // 4. Update Third Person Camera & Avoid Mountain Terrain Occlusion
    const camOffset = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDistance,
      Math.sin(this.camPitch) * this.camDistance + this.camHeight,
      Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDistance
    );

    const targetCamPos = this.position.clone().add(camOffset);

    // Keep camera above any mountain peak or hill behind player
    const camTerrainY = this.world ? this.world.getTerrainHeight(targetCamPos.x, targetCamPos.z) : 0;
    if (targetCamPos.y < camTerrainY + 1.2) {
      targetCamPos.y = camTerrainY + 1.2;
    }

    // Smooth camera chase
    this.camera.position.lerp(targetCamPos, Math.min(1, dt * 12));

    const lookTarget = this.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    this.camera.lookAt(lookTarget);
  }

  getPosition() {
    return this.position;
  }
}
