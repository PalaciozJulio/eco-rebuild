import confetti from 'canvas-confetti';
import { ITEM_DEFS } from './Inventory.js';
import { MACHINES } from './Machines.js';

export class UIManager {
  constructor(inventory, missionManager, machineManager, sound) {
    this.inventory = inventory;
    this.missionManager = missionManager;
    this.machineManager = machineManager;
    this.sound = sound;

    this.activeModal = null;
    this.currentMachine = null;

    this.initElements();
    this.bindEvents();
    this.updateHUD();
    this.updateInventoryBar();
  }

  initElements() {
    // HUD Metrics
    this.cleanBar = document.getElementById('metric-clean-bar');
    this.cleanVal = document.getElementById('metric-clean-val');
    this.techBar = document.getElementById('metric-tech-bar');
    this.techVal = document.getElementById('metric-tech-val');
    this.infraBar = document.getElementById('metric-infra-bar');
    this.infraVal = document.getElementById('metric-infra-val');

    // Mission tracker
    this.missionTitle = document.getElementById('current-mission-title');
    this.missionDesc = document.getElementById('current-mission-desc');
    this.missionReqs = document.getElementById('current-mission-reqs');

    // Inventory bar
    this.quickMaterials = document.getElementById('quick-materials');

    // Prompt
    this.interactionPrompt = document.getElementById('interaction-prompt');
    this.promptAction = document.getElementById('prompt-action');
    this.promptTarget = document.getElementById('prompt-target');

    // Scavenge overlay
    this.scavengeOverlay = document.getElementById('scavenge-overlay');
    this.scavengeBar = document.getElementById('scavenge-progress-bar');
    this.scavengeTitle = document.getElementById('scavenge-title');

    // Modals
    this.laptopModal = document.getElementById('laptop-modal');
    this.machineModal = document.getElementById('machine-modal');
    this.inventoryModal = document.getElementById('inventory-modal');
    this.helpModal = document.getElementById('help-modal');
    this.celebrationOverlay = document.getElementById('celebration-overlay');

    // Notifications
    this.notificationsContainer = document.getElementById('notifications-container');
  }

  bindEvents() {
    // Buttons toggles
    document.getElementById('btn-toggle-laptop')?.addEventListener('click', () => {
      this.sound.playClick();
      this.openLaptopModal();
    });

    document.getElementById('btn-toggle-inventory')?.addEventListener('click', () => {
      this.sound.playClick();
      this.openInventoryModal();
    });

    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
      const isUnmuted = this.sound.toggleMute();
      const soundIcon = document.getElementById('sound-icon');
      if (soundIcon) soundIcon.textContent = isUnmuted ? '🔊' : '🔇';
      this.notify(isUnmuted ? 'Sonido Activado' : 'Sonido Silenciado', '🎵');
    });

    document.getElementById('btn-help-toggle')?.addEventListener('click', () => {
      this.sound.playClick();
      this.openHelpModal();
    });

    // Close buttons
    document.getElementById('btn-close-laptop')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-close-machine')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-close-inventory')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-close-help')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-continue-celebration')?.addEventListener('click', () => {
      this.celebrationOverlay.classList.add('hidden');
    });

    // Inventory tabs
    const invTabs = document.querySelectorAll('.inventory-tabs .tab-btn');
    invTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sound.playClick();
        invTabs.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.renderInventoryGrid(e.target.dataset.tab);
      });
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModals();
      } else if (e.key.toLowerCase() === 't') {
        if (this.activeModal === this.laptopModal) {
          this.closeModals();
        } else if (!this.activeModal) {
          this.openLaptopModal();
        }
      } else if (e.key.toLowerCase() === 'i') {
        if (this.activeModal === this.inventoryModal) {
          this.closeModals();
        } else if (!this.activeModal) {
          this.openInventoryModal();
        }
      }
    });

    // Listeners for data updates
    this.inventory.onChange(() => {
      this.updateHUD();
      this.updateInventoryBar();
      if (this.activeModal === this.machineModal) {
        this.renderMachineRecipes(this.currentMachine);
      }
      if (this.activeModal === this.laptopModal) {
        this.renderLaptopDetail();
      }
      if (this.activeModal === this.inventoryModal) {
        const activeTab = document.querySelector('.inventory-tabs .tab-btn.active')?.dataset.tab || 'scrap';
        this.renderInventoryGrid(activeTab);
      }
    });

    this.missionManager.onChange(() => {
      this.updateHUD();
      if (this.activeModal === this.laptopModal) {
        this.renderLaptopMissionsList();
        this.renderLaptopDetail();
      }
    });
  }

  notify(message, icon = '✨') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    this.notificationsContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  showInteractionPrompt(action, target) {
    this.promptAction.textContent = action;
    this.promptTarget.textContent = target;
    this.interactionPrompt.classList.remove('hidden');
  }

  hideInteractionPrompt() {
    this.interactionPrompt.classList.add('hidden');
  }

  showScavengeProgress(name, progress) {
    this.scavengeOverlay.classList.remove('hidden');
    this.scavengeTitle.textContent = `Desarmando ${name}...`;
    this.scavengeBar.style.width = `${Math.min(100, Math.floor(progress * 100))}%`;
  }

  hideScavengeProgress() {
    this.scavengeOverlay.classList.add('hidden');
  }

  updateHUD() {
    // ODS Metrics
    const m = this.missionManager.metrics;
    this.cleanBar.style.width = `${m.clean}%`;
    this.cleanVal.textContent = `${m.clean}%`;

    this.techBar.style.width = `${m.tech}%`;
    this.techVal.textContent = `${m.tech}%`;

    this.infraBar.style.width = `${m.infra}%`;
    this.infraVal.textContent = `${m.infra}%`;

    // Active Mission
    const active = this.missionManager.getActiveMission();
    if (!active) {
      this.missionTitle.textContent = '¡Todos los proyectos completados!';
      this.missionDesc.textContent = 'Has transformado completamente la región en un polo sustentable.';
      this.missionReqs.innerHTML = '';
      return;
    }

    const isCompleted = this.missionManager.isMissionCompleted(active.id);
    this.missionTitle.textContent = `${active.code}: ${active.title}`;
    this.missionDesc.textContent = active.subtitle;

    let reqsHtml = '';
    Object.entries(active.requirements).forEach(([itemId, requiredQty]) => {
      const def = ITEM_DEFS[itemId];
      const haveQty = this.inventory.get(itemId);
      const isSatisfied = haveQty >= requiredQty;
      reqsHtml += `
        <div class="req-item">
          <span class="req-name">${def.icon} ${def.name}</span>
          <span class="req-status ${isSatisfied ? 'completed' : 'pending'}">${haveQty}/${requiredQty}</span>
        </div>
      `;
    });
    this.missionReqs.innerHTML = reqsHtml;
  }

  updateInventoryBar() {
    // Show 4 key materials in bottom quickbar
    const keyItems = ['cobre_puro', 'oro_refinado', 'caucho_ecologico', 'silicio_grado_solar'];
    let html = '';
    keyItems.forEach(id => {
      const def = ITEM_DEFS[id];
      const count = this.inventory.get(id);
      html += `
        <div class="quick-mat-slot" title="${def.desc}">
          <span class="slot-icon">${def.icon}</span>
          <span class="slot-qty">${count}</span>
          <span class="slot-name">${def.name}</span>
        </div>
      `;
    });
    this.quickMaterials.innerHTML = html;
  }

  closeModals() {
    if (this.activeModal) {
      this.activeModal.classList.add('hidden');
      this.activeModal = null;
    }
  }

  // LAPTOP / ECO-OS MODAL
  openLaptopModal() {
    this.closeModals();
    this.sound.playClick();
    this.activeModal = this.laptopModal;
    this.laptopModal.classList.remove('hidden');

    this.renderLaptopMissionsList();
    this.renderLaptopDetail();
  }

  renderLaptopMissionsList() {
    const listEl = document.getElementById('missions-list');
    const counterEl = document.getElementById('completed-counter');
    const missions = this.missionManager.missions;
    const completedCount = this.missionManager.completedMissions.size;

    counterEl.textContent = `${completedCount}/${missions.length} Implementadas`;

    let html = '';
    missions.forEach((m, idx) => {
      const isDone = this.missionManager.isMissionCompleted(m.id);
      const isActive = this.missionManager.activeMissionIndex === idx;

      html += `
        <li class="mission-tab-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}" data-idx="${idx}">
          <div class="tab-top">
            <span class="tab-code">${m.code}</span>
            ${isDone ? '<span class="tab-badge done">LISTO</span>' : (isActive ? '<span class="tab-badge active-badge">EN CURSO</span>' : '')}
          </div>
          <span class="tab-title">${m.title}</span>
        </li>
      `;
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.mission-tab-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        this.sound.playClick();
        this.missionManager.setActiveMission(idx);
      });
    });
  }

  renderLaptopDetail() {
    const detailEl = document.getElementById('mission-detail-view');
    const active = this.missionManager.getActiveMission();
    if (!active) return;

    const isDone = this.missionManager.isMissionCompleted(active.id);
    const canComplete = this.missionManager.canCompleteActive();

    let reqsGrid = '';
    Object.entries(active.requirements).forEach(([itemId, requiredQty]) => {
      const def = ITEM_DEFS[itemId];
      const haveQty = this.inventory.get(itemId);
      const satisfied = haveQty >= requiredQty;
      reqsGrid += `
        <div class="need-card ${satisfied ? 'satisfied' : ''}">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.6rem;">${def.icon}</span>
            <div>
              <div style="font-weight:700; font-size:0.85rem; color:white;">${def.name}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${def.desc}</div>
            </div>
          </div>
          <div style="font-family:var(--font-mono); font-weight:800; font-size:1.1rem; color:${satisfied ? 'var(--eco-green)' : 'var(--eco-gold)'};">
            ${haveQty} / ${requiredQty}
          </div>
        </div>
      `;
    });

    detailEl.innerHTML = `
      <div class="project-detail-header">
        <span class="project-tag">SOLICITUD TERRITORIAL :: ${active.code}</span>
        <h2 class="project-h1">${active.title}</h2>
        <p class="project-story">${active.story}</p>
      </div>

      <div class="recipe-box">
        <h4>📋 Receta de Materiales Puros Requeridos</h4>
        <div class="materials-needed-grid">
          ${reqsGrid}
        </div>
      </div>

      <div class="impact-preview-box">
        <h4>🌱 Impacto Sostenible Estimado (ODS 9)</h4>
        <div class="impact-chips">
          <span class="impact-chip">✨ +${active.rewards.clean}% Descontaminación</span>
          <span class="impact-chip">📶 +${active.rewards.tech}% Conectividad Digital</span>
          <span class="impact-chip">🏗️ +${active.rewards.infra}% Infraestructura Verde</span>
        </div>
      </div>

      <div class="actions-row">
        ${isDone ? `
          <button class="btn-primary-large" style="background:#2e7d32; cursor:default;" disabled>✅ Proyecto Ya Implementado</button>
        ` : `
          <button id="btn-deliver-project" class="btn-primary-large" ${canComplete ? '' : 'disabled style="opacity:0.4; cursor:not-allowed;"'}>
            ${canComplete ? '🚀 Entregar e Implementar Proyecto' : 'Faltan Materiales Refinados'}
          </button>
        `}
      </div>
    `;

    document.getElementById('btn-deliver-project')?.addEventListener('click', () => {
      this.sound.playClick();
      const res = this.missionManager.completeActiveMission();
      if (res.success) {
        this.closeModals();
        this.showCelebration(res.mission, res.worldObject);
      }
    });
  }

  showCelebration(mission, worldObject) {
    // Trigger confetti explosion
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 }
    });

    const titleEl = document.getElementById('celebration-title');
    const descEl = document.getElementById('celebration-desc');
    const statsEl = document.getElementById('celebration-stats');

    titleEl.textContent = `¡${mission.title.toUpperCase()}!`;
    descEl.textContent = `La obra ha sido erigida en la región con materiales 100% circulares.`;

    statsEl.innerHTML = `
      <div class="impact-stat-item">
        <span class="stat-label">Descontaminación</span>
        <span class="stat-value">+${mission.rewards.clean}%</span>
      </div>
      <div class="impact-stat-item">
        <span class="stat-label">Conectividad</span>
        <span class="stat-value">+${mission.rewards.tech}%</span>
      </div>
      <div class="impact-stat-item">
        <span class="stat-label">Infraestructura</span>
        <span class="stat-value">+${mission.rewards.infra}%</span>
      </div>
    `;

    this.celebrationOverlay.classList.remove('hidden');

    // Notify world to reveal the object
    if (this.onWorldImpact) {
      this.onWorldImpact(worldObject, this.missionManager.metrics.clean);
    }
  }

  // MACHINE MODAL
  openMachineModal(machineId) {
    const def = MACHINES[machineId];
    if (!def) return;

    this.closeModals();
    this.sound.playClick();
    this.currentMachine = machineId;
    this.activeModal = this.machineModal;
    this.machineModal.classList.remove('hidden');

    document.getElementById('modal-machine-icon').textContent = def.icon;
    document.getElementById('modal-machine-name').textContent = def.name;
    document.getElementById('modal-machine-sub').textContent = def.subtitle;

    this.renderMachineRecipes(machineId);
    this.updateMachineProgress(machineId);
  }

  renderMachineRecipes(machineId) {
    const def = MACHINES[machineId];
    const container = document.getElementById('machine-recipes-list');
    const isBusy = this.machineManager.isBusy(machineId);

    let html = '';
    def.recipes.forEach(recipe => {
      const canCraft = this.inventory.hasMultiple(recipe.input) && !isBusy;

      let inHtml = Object.entries(recipe.input).map(([id, qty]) => {
        const item = ITEM_DEFS[id];
        const have = this.inventory.get(id);
        const sat = have >= qty;
        return `<span class="recipe-badge" style="color:${sat ? 'white' : '#ff5252'}">${item.icon} ${qty} ${item.name} (${have})</span>`;
      }).join(' + ');

      let outHtml = Object.entries(recipe.output).map(([id, qty]) => {
        const item = ITEM_DEFS[id];
        return `<span class="recipe-badge" style="color:var(--eco-cyan);">${item.icon} +${qty} ${item.name}</span>`;
      }).join(' + ');

      html += `
        <div class="recipe-card">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <strong style="color:white; font-size:0.9rem;">${recipe.name}</strong>
            <div class="recipe-inputs-outputs">
              <div>${inHtml}</div>
              <span style="color:var(--text-muted);">➔</span>
              <div>${outHtml}</div>
            </div>
            <span style="font-size:0.7rem; color:var(--text-muted);">⏱️ Tiempo: ${recipe.duration}s</span>
          </div>

          <button class="btn-craft" data-rec="${recipe.id}" ${canCraft ? '' : 'disabled'}>
            ${isBusy ? 'En Proceso...' : 'Extraer / Refinar'}
          </button>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.btn-craft').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const recipeId = e.currentTarget.dataset.rec;
        this.startMachineCrafting(machineId, recipeId);
      });
    });
  }

  startMachineCrafting(machineId, recipeId) {
    const statusText = document.getElementById('machine-status-text');
    const statusDot = document.getElementById('machine-status-dot');
    const visual = document.getElementById('processing-visual');
    const progressBar = document.getElementById('machine-progress-bar');

    statusDot.classList.add('active');
    visual.classList.add('running');
    statusText.textContent = 'Procesando materiales limpios...';

    const result = this.machineManager.startJob(
      machineId,
      recipeId,
      (recipe) => {
        // Complete
        statusDot.classList.remove('active');
        visual.classList.remove('running');
        statusText.textContent = '¡Proceso terminado! Materiales recolectados.';
        progressBar.style.width = '0%';
        this.notify('Extracción completada con éxito', '🧪');
        this.renderMachineRecipes(machineId);
      },
      (progress) => {
        // Tick
        progressBar.style.width = `${Math.floor(progress * 100)}%`;
      }
    );

    if (result.success) {
      this.renderMachineRecipes(machineId);
    }
  }

  updateMachineProgress(machineId) {
    const progressBar = document.getElementById('machine-progress-bar');
    const statusText = document.getElementById('machine-status-text');
    const statusDot = document.getElementById('machine-status-dot');
    const visual = document.getElementById('processing-visual');

    const job = this.machineManager.getJob(machineId);
    if (job) {
      statusDot.classList.add('active');
      visual.classList.add('running');
      statusText.textContent = `Extrayendo: ${job.recipe.name}...`;
      progressBar.style.width = `${Math.floor(job.progress * 100)}%`;
    } else {
      statusDot.classList.remove('active');
      visual.classList.remove('running');
      statusText.textContent = 'Listo para procesar';
      progressBar.style.width = '0%';
    }
  }

  // INVENTORY MODAL
  openInventoryModal() {
    this.closeModals();
    this.sound.playClick();
    this.activeModal = this.inventoryModal;
    this.inventoryModal.classList.remove('hidden');

    const activeTab = document.querySelector('.inventory-tabs .tab-btn.active')?.dataset.tab || 'scrap';
    this.renderInventoryGrid(activeTab);
  }

  renderInventoryGrid(tabType) {
    const grid = document.getElementById('inventory-grid');
    const allItems = this.inventory.getAll();

    const filtered = Object.entries(allItems).filter(([id, count]) => {
      const def = ITEM_DEFS[id];
      return def && def.type === tabType;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-muted);">
          No tienes ${tabType === 'scrap' ? 'chatarra recolectada' : 'materiales refinados'} en tu inventario.
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(([id, count]) => {
      const def = ITEM_DEFS[id];
      html += `
        <div class="inv-item-card" title="${def.desc}">
          <span class="inv-icon">${def.icon}</span>
          <span class="inv-name">${def.name}</span>
          <span class="inv-count">x${count}</span>
          <span class="inv-category">${def.type === 'scrap' ? 'Chatarra' : 'Refinado'}</span>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  openHelpModal() {
    this.closeModals();
    this.sound.playClick();
    this.activeModal = this.helpModal;
    this.helpModal.classList.remove('hidden');
  }
}
