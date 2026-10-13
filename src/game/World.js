import * as THREE from 'three';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.interactables = [];
    this.animatedObjects = [];
    this.unlockedInfrastructure = {};
    this.colliders = []; // Solid obstacles for player collision

    // Dynamic environmental parameters
    this.fog = new THREE.FogExp2(0x56605e, 0.015);
    this.scene.fog = this.fog;

    this.createEnvironment();
    this.createWorkshop();
    this.createScrapNodes();
    this.createConstructibles();
  }

  getTerrainHeight(x, z) {
    // Workshop center pavilion pad (player stands on top surface at y = 0.5)
    if (Math.abs(x) <= 13.0 && Math.abs(z) <= 11.0) {
      return 0.5;
    }
    const distFromCenter = Math.hypot(x, z);
    if (distFromCenter <= 22) {
      // Smooth ramp transition from workshop pad to outside ground
      const t = (distFromCenter - 13.0) / 9.0;
      return 0.5 * (1 - Math.max(0, Math.min(1, t)));
    }

    // River channel on East side (width ~26 around x=65)
    const distToRiver = Math.abs(x - 65);
    if (distToRiver < 14) {
      return -0.2; // slight dip for river bed
    }

    // Rolling hills formula
    const baseHeight = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 2.2 +
                       Math.sin(x * 0.03) * 1.5;

    // Mountain ridge in the North where the WiFi tower sits (z < -30)
    let mountainRidge = 0;
    if (z < -28) {
      const depth = Math.min(1, (-z - 28) / 38);
      mountainRidge = depth * 5.5 + Math.sin(x * 0.06) * 2.0;
    }

    return Math.max(0, baseHeight + mountainRidge);
  }

  createEnvironment() {
    // Ground terrain with high resolution for smooth hill traversal
    const groundGeo = new THREE.PlaneGeometry(280, 280, 80, 80);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const localX = pos.getX(i);
      const localY = pos.getY(i);
      const worldX = localX;
      const worldZ = -localY; // rotation.x = -Math.PI / 2

      // Keep ground terrain under workshop at y = 0 so it NEVER overlaps with the workshop floor at y = 0.5!
      if (Math.abs(worldX) <= 14.5 && Math.abs(worldZ) <= 12.5) {
        pos.setZ(i, 0.0);
      } else {
        const height = this.getTerrainHeight(worldX, worldZ);
        pos.setZ(i, height);
      }
    }
    groundGeo.computeVertexNormals();

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x5a5f57, // Starts dry / greyish-brown polluted tone
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true
    });

    this.ground = new THREE.Mesh(groundGeo, this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // River bed / polluted canal on the East side
    const riverGeo = new THREE.PlaneGeometry(26, 260);
    this.riverMat = new THREE.MeshStandardMaterial({
      color: 0x4a6552, // Murky green-grey water initially
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85
    });
    this.river = new THREE.Mesh(riverGeo, this.riverMat);
    this.river.rotation.x = -Math.PI / 2;
    this.river.position.set(65, 0.05, 0);
    this.scene.add(this.river);

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0x9fa8a3, 0x3e423d, 0.6);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3d6, 1.2);
    this.sunLight.position.set(60, 80, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 250;
    // Eliminates shadow acne / jagged pixelated shadow artifacts
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.04;

    const d = 80;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    // Surrounding rocky hills and barren dead trees placed at terrain height
    this.createTerrainProps();
  }

  createTerrainProps() {
    // Rocks and rubble piles with physical collision
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x474946, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 35; i++) {
      const rockRadius = 1.3 + Math.random() * 2.2;
      const rockGeo = new THREE.DodecahedronGeometry(rockRadius, 1);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 34 + Math.random() * 85;
      const rx = Math.cos(angle) * radius;
      const rz = Math.sin(angle) * radius;
      const ry = this.getTerrainHeight(rx, rz);

      rock.position.set(rx, ry + rockRadius * 0.45, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);

      // Register solid obstacle collider
      this.colliders.push({
        type: 'circle',
        x: rx,
        z: rz,
        radius: rockRadius * 0.9
      });
    }

    // Bare trees that will bloom when region recovers
    this.ecoTrees = [];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d322a });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e4726, roughness: 0.8 });

    for (let i = 0; i < 28; i++) {
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4.5, 6), trunkMat);
      trunk.position.y = 2.25;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), leafMat.clone());
      foliage.position.y = 4.8;
      foliage.castShadow = true;
      treeGroup.add(foliage);

      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.2;
      const dist = 32 + (i % 3) * 18;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;
      const ty = this.getTerrainHeight(tx, tz);

      treeGroup.position.set(tx, ty, tz);
      treeGroup.scale.set(0.6, 0.6, 0.6);

      this.scene.add(treeGroup);
      this.ecoTrees.push({ group: treeGroup, foliage });

      // Register trunk collider
      this.colliders.push({
        type: 'circle',
        x: tx,
        z: tz,
        radius: 0.7
      });
    }
  }

  createWorkshop() {
    // Center workshop pavilion raised platform (thickness 0.5, top surface at y = 0.5)
    const baseGeo = new THREE.BoxGeometry(26, 0.5, 22);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x222d3d,
      roughness: 0.5,
      metalness: 0.2
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, 0.25, 0);
    baseMesh.receiveShadow = true;
    this.scene.add(baseMesh);

    // Workshop perimeter glowing lines on top of platform at y = 0.52
    const lineGeo = new THREE.BoxGeometry(26.2, 0.05, 0.3);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const lineNorth = new THREE.Mesh(lineGeo, lineMat);
    lineNorth.position.set(0, 0.52, -10.9);
    const lineSouth = new THREE.Mesh(lineGeo, lineMat);
    lineSouth.position.set(0, 0.52, 10.9);
    this.scene.add(lineNorth, lineSouth);

    // Pillars and solar canopy roof
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.6, roughness: 0.3 });
    const pillars = [
      [-12, -9.5], [12, -9.5], [-12, 9.5], [12, 9.5]
    ];
    pillars.forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6, 0.7), pillarMat);
      pillar.position.set(px, 3, pz);
      pillar.castShadow = true;
      this.scene.add(pillar);

      // Solid pillar collider
      this.colliders.push({
        type: 'circle',
        x: px,
        z: pz,
        radius: 0.65
      });
    });

    // Glass Canopy with solar cells
    const roofGeo = new THREE.BoxGeometry(26, 0.3, 22);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0b253b,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.75
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 6, 0);
    this.scene.add(roof);

    // Signboard "TALLER DE INNOVACIÓN CIRCULAR - ODS 9"
    const signGroup = new THREE.Group();
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x111827 })
    );
    signGroup.add(signBoard);

    const signLight = new THREE.PointLight(0x00e676, 2, 8);
    signLight.position.set(0, 0, 1);
    signGroup.add(signLight);
    signGroup.position.set(0, 5.2, 11);
    this.scene.add(signGroup);

    // --- INTERACTIVE ELEMENT: LAPTOP / TERMINAL ---
    this.createLaptopTerminal();

    // --- INTERACTIVE ELEMENT: 3 EXTRACTOR MACHINES ---
    this.createExtractorMachines();
  }

  createLaptopTerminal() {
    const tableGroup = new THREE.Group();
    // Desk
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.3, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.3, metalness: 0.5 })
    );
    desk.position.set(0, 0.65, 0);
    desk.castShadow = true;
    tableGroup.add(desk);

    // Laptop base
    const laptopBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.06, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.9, roughness: 0.2 })
    );
    laptopBase.position.set(0, 1.33, 0);
    tableGroup.add(laptopBase);

    // Laptop screen (tilted)
    const laptopScreen = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.75, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00838f,
        emissiveIntensity: 0.8
      })
    );
    laptopScreen.position.set(0, 1.68, -0.35);
    laptopScreen.rotation.x = -0.25;
    tableGroup.add(laptopScreen);

    // Terminal holo glow light
    const termLight = new THREE.PointLight(0x00e5ff, 2.5, 6);
    termLight.position.set(0, 2, 0);
    tableGroup.add(termLight);

    // Floating Holo Icon above terminal
    const holoIcon = this.createHoloRing(0x00e5ff);
    holoIcon.position.set(0, 2.7, 0);
    tableGroup.add(holoIcon);

    tableGroup.position.set(0, 0.4, -6.5);
    this.scene.add(tableGroup);

    // Register solid obstacle for the laptop desk so player cannot walk through the computer
    this.colliders.push({
      type: 'box',
      minX: -1.8,
      maxX: 1.8,
      minZ: -7.6,
      maxZ: -5.4
    });

    // Register interactable
    this.interactables.push({
      id: 'laptop',
      type: 'laptop',
      name: 'Terminal Central Eco-OS',
      position: new THREE.Vector3(0, 1, -6.5),
      radius: 3.5,
      actionText: 'Abrir Pedidos ODS 9'
    });
  }

  createHoloRing(colorHex) {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(0.45, 0.05, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    this.animatedObjects.push({
      update: (time) => {
        ringMesh.rotation.y = time * 1.5;
        ringMesh.rotation.x = Math.sin(time) * 0.3;
        ringMesh.position.y = Math.sin(time * 2) * 0.12;
      }
    });
    return group;
  }

  createExtractorMachines() {
    // 1. EXTRACTORA HIDROMETALÚRGICA E-WASTE (Left side: -8, 0.4, 0)
    const m1Group = new THREE.Group();
    const m1Body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.8, 3.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.2 })
    );
    m1Body.position.y = 1.6;
    m1Body.castShadow = true;
    m1Group.add(m1Body);

    // Glowing core vat
    const m1Vat = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 1.4, 16),
      new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.8
      })
    );
    m1Vat.position.y = 1.8;
    m1Group.add(m1Vat);

    const m1Holo = this.createHoloRing(0x00e5ff);
    m1Holo.position.set(0, 4.0, 0);
    m1Group.add(m1Holo);

    m1Group.position.set(-8, 0.4, 0);
    this.scene.add(m1Group);

    // Solid obstacle for Extractor 1
    this.colliders.push({
      type: 'circle',
      x: -8,
      z: 0,
      radius: 1.9
    });

    this.interactables.push({
      id: 'extractor_electronica',
      type: 'machine',
      name: 'Extractora Hidrometalúrgica E-Waste',
      position: new THREE.Vector3(-8, 1, 0),
      radius: 4.0,
      actionText: 'Procesar Chatarra Electrónica'
    });

    // 2. DESPOLIMERIZADORA DE CAUCHO & PLÁSTICOS (Center Right: 0, 0.4, 6)
    const m2Group = new THREE.Group();
    const m2Body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x2e3b2e, metalness: 0.6, roughness: 0.3 })
    );
    m2Body.position.y = 1.3;
    m2Body.castShadow = true;
    m2Group.add(m2Body);

    // Hopper funnel for tires
    const m2Funnel = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x388e3c, metalness: 0.7, roughness: 0.2 })
    );
    m2Funnel.rotation.x = Math.PI;
    m2Funnel.position.y = 3.0;
    m2Group.add(m2Funnel);

    const m2Holo = this.createHoloRing(0x00e676);
    m2Holo.position.set(0, 4.2, 0);
    m2Group.add(m2Holo);

    m2Group.position.set(0, 0.4, 6);
    this.scene.add(m2Group);

    // Solid obstacle for Polymer Refiner
    this.colliders.push({
      type: 'circle',
      x: 0,
      z: 6,
      radius: 1.9
    });

    this.interactables.push({
      id: 'refinadora_polimeros',
      type: 'machine',
      name: 'Despolimerizadora de Caucho y Cables',
      position: new THREE.Vector3(0, 1, 6),
      radius: 4.0,
      actionText: 'Refinar Caucho y Polímeros'
    });

    // 3. FUNDIDORA SOLAR POR INDUCCIÓN (Right side: 8, 0.4, 0)
    const m3Group = new THREE.Group();
    const m3Body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.0, 3.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x3e2723, metalness: 0.9, roughness: 0.15 })
    );
    m3Body.position.y = 1.7;
    m3Body.castShadow = true;
    m3Group.add(m3Body);

    // Induction glow chamber
    const m3Core = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.25, 12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xff6d00,
        emissive: 0xff3d00,
        emissiveIntensity: 0.8
      })
    );
    m3Core.rotation.x = Math.PI / 2;
    m3Core.position.y = 1.8;
    m3Group.add(m3Core);

    const m3Holo = this.createHoloRing(0xff9100);
    m3Holo.position.set(0, 4.2, 0);
    m3Group.add(m3Holo);

    m3Group.position.set(8, 0.4, 0);
    this.scene.add(m3Group);

    // Solid obstacle for Solar Smelter
    this.colliders.push({
      type: 'circle',
      x: 8,
      z: 0,
      radius: 2.0
    });

    this.interactables.push({
      id: 'fundidora_solar',
      type: 'machine',
      name: 'Fundidora Solar por Inducción',
      position: new THREE.Vector3(8, 1, 0),
      radius: 4.0,
      actionText: 'Fundir Metales y Litio'
    });
  }

  createScrapNodes() {
    // Create rich piles of scrap across the wasteland for gathering
    const scrapConfigs = [
      // E-Waste Zones (North-West)
      {
        id: 'node_ewaste_1',
        scrapItem: 'smartphones_viejos',
        name: 'Vertedero de E-Waste & Móviles',
        pos: [-30, 0, -28],
        color: 0x00bcd4,
        type: 'smartphones_viejos',
        meshType: 'electronics'
      },
      {
        id: 'node_pcb_1',
        scrapItem: 'placas_madre',
        name: 'Contenedor de Placas Quemadas',
        pos: [-45, 0, -12],
        color: 0x4caf50,
        type: 'placas_madre',
        meshType: 'pcb'
      },
      // Industrial scrap (South-West)
      {
        id: 'node_metal_1',
        scrapItem: 'chatarra_industrial',
        name: 'Estructura Industrial Colapsada',
        pos: [-34, 0, 32],
        color: 0x78909c,
        type: 'chatarra_industrial',
        meshType: 'beams'
      },
      {
        id: 'node_metal_2',
        scrapItem: 'chatarra_industrial',
        name: 'Cúmulo de Chatarra y Tuberías',
        pos: [-18, 0, 45],
        color: 0x78909c,
        type: 'chatarra_industrial',
        meshType: 'beams'
      },
      // Tires & Rubber (North-East)
      {
        id: 'node_tires_1',
        scrapItem: 'neumaticos_gastados',
        name: 'Montículo de Neumáticos Abandonados',
        pos: [28, 0, -32],
        color: 0x212121,
        type: 'neumaticos_gastados',
        meshType: 'tires'
      },
      {
        id: 'node_cables_1',
        scrapItem: 'cables_enredados',
        name: 'Bobinas de Cableado Eléctrico',
        pos: [42, 0, -18],
        color: 0xff9800,
        type: 'cables_enredados',
        meshType: 'cables'
      },
      // Battery storage (East / South-East)
      {
        id: 'node_battery_1',
        scrapItem: 'baterias_degradadas',
        name: 'Depósito de Baterías de Ion-Litio',
        pos: [38, 0, 35],
        color: 0x9c27b0,
        type: 'baterias_degradadas',
        meshType: 'battery'
      }
    ];

    this.scrapNodes = [];

    scrapConfigs.forEach(cfg => {
      const group = new THREE.Group();
      const nodeX = cfg.pos[0];
      const nodeZ = cfg.pos[2];
      const nodeY = this.getTerrainHeight(nodeX, nodeZ);
      group.position.set(nodeX, nodeY, nodeZ);

      // Create distinctive visual geometry depending on scrap type
      if (cfg.meshType === 'tires') {
        // Stack of tires
        for (let j = 0; j < 5; j++) {
          const tire = new THREE.Mesh(
            new THREE.TorusGeometry(0.8, 0.35, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
          );
          tire.rotation.x = Math.PI / 2;
          tire.position.set((j % 2) * 0.4 - 0.2, 0.4 + j * 0.4, (j % 3) * 0.3);
          tire.castShadow = true;
          group.add(tire);
        }
      } else if (cfg.meshType === 'electronics' || cfg.meshType === 'pcb') {
        // Piles of computer shells and green motherboards
        for (let j = 0; j < 6; j++) {
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.3, 1.3),
            new THREE.MeshStandardMaterial({
              color: j % 2 === 0 ? 0x2e7d32 : 0x1e293b,
              roughness: 0.5
            })
          );
          box.position.set(Math.sin(j) * 0.8, 0.2 + j * 0.2, Math.cos(j) * 0.8);
          box.rotation.set(0.2, j * 0.8, 0.1);
          box.castShadow = true;
          group.add(box);
        }
      } else if (cfg.meshType === 'beams') {
        // Rusted steel beams and gears
        for (let j = 0; j < 4; j++) {
          const beam = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.4, 3.2),
            new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8, metalness: 0.5 })
          );
          beam.position.set(j * 0.4 - 0.6, 0.4 + j * 0.3, 0);
          beam.rotation.set(0.3 * j, j * 0.7, 0.4);
          beam.castShadow = true;
          group.add(beam);
        }
      } else {
        // Barrels / batteries
        for (let j = 0; j < 3; j++) {
          const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12),
            new THREE.MeshStandardMaterial({
              color: cfg.color,
              metalness: 0.4,
              roughness: 0.4
            })
          );
          barrel.position.set((j - 1) * 0.9, 0.7, (j % 2) * 0.3);
          barrel.castShadow = true;
          group.add(barrel);
        }
      }

      // Marker beacon with animated glowing aura
      const beaconGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const beaconMat = new THREE.MeshBasicMaterial({ color: cfg.color });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 2.4;
      group.add(beacon);

      const beaconLight = new THREE.PointLight(cfg.color, 1.5, 8);
      beaconLight.position.y = 2.4;
      group.add(beaconLight);

      this.scene.add(group);

      // Register scrap node collider
      this.colliders.push({
        type: 'circle',
        x: nodeX,
        z: nodeZ,
        radius: 1.3
      });

      const interactable = {
        id: cfg.id,
        type: 'scrap_pile',
        scrapItem: cfg.scrapItem,
        name: cfg.name,
        position: new THREE.Vector3(nodeX, nodeY + 1, nodeZ),
        radius: 4.8,
        actionText: 'Recolectar y Desarmar',
        group,
        beaconLight
      };

      this.interactables.push(interactable);
      this.scrapNodes.push(interactable);

      this.animatedObjects.push({
        update: (time) => {
          beacon.position.y = 2.4 + Math.sin(time * 3 + cfg.pos[0]) * 0.25;
        }
      });
    });
  }

  createConstructibles() {
    // 1. WIFI TOWER (ODS 9 - Mission 1) on Mountain (North: 0, 0, -55)
    this.wifiTowerGroup = new THREE.Group();
    const towerMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 1.2, 22, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.8, roughness: 0.2 })
    );
    towerMast.position.y = 11;
    this.wifiTowerGroup.add(towerMast);

    // Antenna array on top
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 16, 16, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.7, roughness: 0.2 })
    );
    dish.rotation.x = -Math.PI / 2;
    dish.position.y = 21;
    this.wifiTowerGroup.add(dish);

    // Holographic signal wave pulses
    const waveGeo = new THREE.RingGeometry(0.8, 1.1, 32);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.rotation.x = Math.PI / 2;
    waveMesh.position.y = 22;
    this.wifiTowerGroup.add(waveMesh);

    this.wifiTowerGroup.position.set(0, 0, -55);
    this.wifiTowerGroup.visible = false; // Hidden until unlocked!
    this.scene.add(this.wifiTowerGroup);

    this.animatedObjects.push({
      update: (time) => {
        if (this.wifiTowerGroup.visible) {
          const s = 1 + (time * 2 % 3.5);
          waveMesh.scale.set(s, s, s);
          waveMat.opacity = Math.max(0, 1 - (s / 3.5));
        }
      }
    });

    // 2. ECO ROAD (ODS 9 - Mission 2) (Spans East-West from -70 to 70 at Z = 16)
    this.ecoRoadGroup = new THREE.Group();
    const roadGeo = new THREE.PlaneGeometry(140, 6);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x212121,
      roughness: 0.6,
      metalness: 0.1
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.y = 0.15;
    this.ecoRoadGroup.add(roadMesh);

    // Glowing green edge lines & solar cat-eyes
    const curbGeo = new THREE.BoxGeometry(140, 0.1, 0.2);
    const curbMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });
    const curb1 = new THREE.Mesh(curbGeo, curbMat);
    curb1.position.set(0, 0.2, 2.9);
    const curb2 = new THREE.Mesh(curbGeo, curbMat);
    curb2.position.set(0, 0.2, -2.9);
    this.ecoRoadGroup.add(curb1, curb2);

    this.ecoRoadGroup.position.set(0, 0, 16);
    this.ecoRoadGroup.visible = false;
    this.scene.add(this.ecoRoadGroup);

    // 3. SOLAR FARM & WIND TURBINES (ODS 9 - Mission 3) (South-West: -55, 0, 45)
    this.solarFarmGroup = new THREE.Group();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(3.5, 0.1, 2.2),
          new THREE.MeshStandardMaterial({
            color: 0x01579b,
            metalness: 0.9,
            roughness: 0.1
          })
        );
        panel.rotation.x = 0.45;
        panel.position.set(c * 4.5 - 4.5, 1.2, r * 4.0 - 4.0);
        panel.castShadow = true;
        this.solarFarmGroup.add(panel);
      }
    }

    // Wind turbines
    this.turbineBlades = [];
    [-12, 12].forEach((tx, idx) => {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.7, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      tower.position.set(tx, 8, -8);
      tower.castShadow = true;
      this.solarFarmGroup.add(tower);

      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(tx, 16, -7.5);
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 5.2, 0.08),
          new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        blade.rotation.z = (b * Math.PI * 2) / 3;
        blade.position.y = Math.cos(blade.rotation.z) * 2.5;
        blade.position.x = -Math.sin(blade.rotation.z) * 2.5;
        bladesGroup.add(blade);
      }
      this.solarFarmGroup.add(bladesGroup);
      this.turbineBlades.push(bladesGroup);
    });

    this.solarFarmGroup.position.set(-52, 0, 48);
    this.solarFarmGroup.visible = false;
    this.scene.add(this.solarFarmGroup);

    this.animatedObjects.push({
      update: (time) => {
        if (this.solarFarmGroup.visible) {
          this.turbineBlades.forEach((tb, i) => {
            tb.rotation.z = time * (2.2 + i * 0.4);
          });
        }
      }
    });

    // 4. RIVER SENSORS (ODS 9 - Mission 4) (East side along river: 65, 0, 0)
    this.riverSensorsGroup = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const buoy = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 0.6, 1.4, 16),
        new THREE.MeshStandardMaterial({ color: 0x00e676, metalness: 0.6, roughness: 0.2 })
      );
      body.position.y = 0.5;
      buoy.add(body);

      const sensorLight = new THREE.PointLight(0x00e676, 2, 6);
      sensorLight.position.y = 1.6;
      buoy.add(sensorLight);

      buoy.position.set(0, 0, -60 + b * 40);
      this.riverSensorsGroup.add(buoy);
    }
    this.riverSensorsGroup.position.set(65, 0, 0);
    this.riverSensorsGroup.visible = false;
    this.scene.add(this.riverSensorsGroup);

    // 5. MEGA BRIDGE (ODS 9 - Mission 5) Across River to Future City (65, 0, 16)
    this.megaBridgeGroup = new THREE.Group();
    const bridgeDeck = new THREE.Mesh(
      new THREE.BoxGeometry(45, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xdce2ec, metalness: 0.8, roughness: 0.2 })
    );
    bridgeDeck.position.set(0, 4.5, 0);
    bridgeDeck.castShadow = true;
    this.megaBridgeGroup.add(bridgeDeck);

    // Arch pillars
    const archMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.9, roughness: 0.1 });
    const arch1 = new THREE.Mesh(new THREE.TorusGeometry(8, 0.6, 12, 32, Math.PI), archMat);
    arch1.position.set(0, 4.5, 3.8);
    const arch2 = new THREE.Mesh(new THREE.TorusGeometry(8, 0.6, 12, 32, Math.PI), archMat);
    arch2.position.set(0, 4.5, -3.8);
    this.megaBridgeGroup.add(arch1, arch2);

    this.megaBridgeGroup.position.set(65, 0, 16);
    this.megaBridgeGroup.visible = false;
    this.scene.add(this.megaBridgeGroup);
  }

  unlockInfrastructure(worldObjectId) {
    if (worldObjectId === 'wifi_tower') {
      this.wifiTowerGroup.visible = true;
      this.spawnCelebrationPulse(this.wifiTowerGroup.position);
    } else if (worldObjectId === 'eco_road') {
      this.ecoRoadGroup.visible = true;
      this.spawnCelebrationPulse(this.ecoRoadGroup.position);
    } else if (worldObjectId === 'solar_farm') {
      this.solarFarmGroup.visible = true;
      this.spawnCelebrationPulse(this.solarFarmGroup.position);
    } else if (worldObjectId === 'river_sensors') {
      this.riverSensorsGroup.visible = true;
      // River water clears into clean sparkling blue
      this.riverMat.color.setHex(0x00bcd4);
      this.riverMat.opacity = 0.9;
      this.spawnCelebrationPulse(this.riverSensorsGroup.position);
    } else if (worldObjectId === 'mega_bridge') {
      this.megaBridgeGroup.visible = true;
      this.spawnCelebrationPulse(this.megaBridgeGroup.position);
    }
  }

  spawnCelebrationPulse(position) {
    // Flash a temporary light pulse at structure location
    const pulseLight = new THREE.PointLight(0x00e676, 12, 40);
    pulseLight.position.copy(position).add(new THREE.Vector3(0, 5, 0));
    this.scene.add(pulseLight);

    let fadeTimer = 0;
    const fadeObj = {
      update: (time, dt) => {
        fadeTimer += dt;
        pulseLight.intensity = Math.max(0, 12 * (1 - fadeTimer / 2.5));
        if (fadeTimer >= 2.5) {
          this.scene.remove(pulseLight);
          const idx = this.animatedObjects.indexOf(fadeObj);
          if (idx !== -1) this.animatedObjects.splice(idx, 1);
        }
      }
    };
    this.animatedObjects.push(fadeObj);
  }

  updateEnvironmentProgression(cleanMetric) {
    // As the clean metric rises (0 -> 100):
    // 1. Fog color turns from yellowish-grey smog into clean atmospheric sky blue
    const t = cleanMetric / 100;
    const smogColor = new THREE.Color(0x56605e);
    const clearSkyColor = new THREE.Color(0x8bc34a).lerp(new THREE.Color(0x81d4fa), 0.7);
    this.fog.color.copy(smogColor).lerp(clearSkyColor, t);
    this.fog.density = 0.015 * (1 - t * 0.65); // Clearer sight distance

    // 2. Ground color turns greener
    const dryGround = new THREE.Color(0x5a5f57);
    const lushGround = new THREE.Color(0x388e3c);
    this.groundMat.color.copy(dryGround).lerp(lushGround, t * 0.8);

    // 3. Trees grow fuller and greener
    this.ecoTrees.forEach((tree, idx) => {
      const scale = 0.6 + t * 0.7;
      tree.group.scale.set(scale, scale, scale);
      tree.foliage.material.color.lerp(new THREE.Color(0x2e7d32), t * 0.5);
    });
  }

  update(time, dt) {
    this.animatedObjects.forEach(obj => obj.update(time, dt));
  }
}
