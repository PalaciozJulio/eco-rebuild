import * as THREE from 'three';
import { sound } from './audio.js';
import { Inventory, ITEM_DEFS } from './game/Inventory.js';
import { World } from './game/World.js';
import { Player } from './game/Player.js';
import { MachineManager } from './game/Machines.js';
import { MissionManager } from './game/Missions.js';
import { UIManager } from './game/UI.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.clock = new THREE.Clock();

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x3a4242);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.5,
      500
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Subsystems
    this.inventory = new Inventory();
    this.world = new World(this.scene);
    this.player = new Player(this.scene, this.camera, this.canvas, sound, this.world);
    this.machineManager = new MachineManager(this.inventory, sound);
    this.missionManager = new MissionManager(this.inventory, sound);
    this.ui = new UIManager(this.inventory, this.missionManager, this.machineManager, sound);

    // Link UI to world impact
    this.ui.onWorldImpact = (worldObject, cleanMetric) => {
      this.world.unlockInfrastructure(worldObject);
      this.world.updateEnvironmentProgression(cleanMetric);
    };

    // Scavenging state
    this.currentInteractable = null;
    this.isScavenging = false;
    this.scavengeTimer = 0;
    this.scavengeTargetTime = 1.4; // 1.4 seconds to dismantle a scrap pile
    this.activeScavengeNode = null;

    this.initEvents();
    this.animate();
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Start ambient music / audio on first user gesture
    const startAudioOnce = () => {
      sound.startAmbient();
      window.removeEventListener('pointerdown', startAudioOnce);
      window.removeEventListener('keydown', startAudioOnce);
    };
    window.addEventListener('pointerdown', startAudioOnce);
    window.addEventListener('keydown', startAudioOnce);

    // Keydown for interaction [E]
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'e') {
        this.handleInteraction();
      }
    });
  }

  handleInteraction() {
    if (!this.currentInteractable || this.ui.activeModal) return;

    const item = this.currentInteractable;

    if (item.type === 'laptop') {
      this.ui.openLaptopModal();
    } else if (item.type === 'machine') {
      this.ui.openMachineModal(item.id);
    } else if (item.type === 'scrap_pile') {
      this.startScavenging(item);
    }
  }

  startScavenging(node) {
    if (this.isScavenging) return;
    this.isScavenging = true;
    this.scavengeTimer = 0;
    this.activeScavengeNode = node;
    this.ui.showScavengeProgress(node.name, 0);
  }

  updateScavenging(dt) {
    if (!this.isScavenging || !this.activeScavengeNode) return;

    this.scavengeTimer += dt;
    const progress = Math.min(1, this.scavengeTimer / this.scavengeTargetTime);
    this.ui.showScavengeProgress(this.activeScavengeNode.name, progress);

    // Periodic tick sound
    if (Math.random() < 0.25) {
      sound.playScavengeTick();
    }

    if (progress >= 1) {
      // Completed!
      const node = this.activeScavengeNode;
      const scrapId = node.scrapItem;
      const count = 1 + Math.floor(Math.random() * 2); // 1 or 2 items
      this.inventory.add(scrapId, count);

      const itemDef = ITEM_DEFS[scrapId];
      sound.playPickupReward();
      this.ui.notify(`+${count} ${itemDef.name} recuperado(s)`, itemDef.icon);

      // Reset scavenging
      this.isScavenging = false;
      this.ui.hideScavengeProgress();
      this.activeScavengeNode = null;
    }
  }

  checkInteractables() {
    if (this.ui.activeModal) {
      this.ui.hideInteractionPrompt();
      return;
    }

    const playerPos = this.player.getPosition();
    let closest = null;
    let minDistance = Infinity;

    for (const item of this.world.interactables) {
      const dist = playerPos.distanceTo(item.position);
      if (dist <= item.radius && dist < minDistance) {
        minDistance = dist;
        closest = item;
      }
    }

    this.currentInteractable = closest;

    if (closest && !this.isScavenging) {
      this.ui.showInteractionPrompt(closest.actionText, closest.name);
    } else if (!this.isScavenging) {
      this.ui.hideInteractionPrompt();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update player physics and camera (unless modal is active)
    if (!this.ui.activeModal) {
      this.player.update(dt);
    }

    // 2. Update interactive prompt distance checks & scavenging
    this.checkInteractables();
    this.updateScavenging(dt);

    // 3. Update world animations (wind turbines, beacons, holo rings)
    this.world.update(elapsedTime, dt);

    // 4. Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Launch game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
