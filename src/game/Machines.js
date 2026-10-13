// Processing machines & recycling extraction logic

export const MACHINES = {
  extractor_electronica: {
    id: 'extractor_electronica',
    name: 'Extractora Hidrometalúrgica E-Waste',
    icon: '⚡',
    subtitle: 'Extracción química ecológica para metales de microchips y placas',
    recipes: [
      {
        id: 'rec_chips',
        name: 'Refinado de Dispositivos Móviles',
        input: { smartphones_viejos: 1 },
        output: { oro_refinado: 1, silicio_grado_solar: 1 },
        duration: 3.0 // seconds
      },
      {
        id: 'rec_boards',
        name: 'Recuperación de Pistas de Cobre',
        input: { placas_madre: 1 },
        output: { cobre_puro: 2, oro_refinado: 1 },
        duration: 3.5
      }
    ]
  },

  refinadora_polimeros: {
    id: 'refinadora_polimeros',
    name: 'Despolimerizadora & Planta de Caucho',
    icon: '🔄',
    subtitle: 'Recuperación de elastómeros y polímeros sintéticos sin quemas',
    recipes: [
      {
        id: 'rec_tires',
        name: 'Granulación de Neumáticos en Desuso',
        input: { neumaticos_gastados: 1 },
        output: { caucho_ecologico: 2 },
        duration: 2.5
      },
      {
        id: 'rec_cables',
        name: 'Separación Criogénica de Cables',
        input: { cables_enredados: 1 },
        output: { cobre_puro: 1, polimero_reforzado: 1 },
        duration: 2.5
      }
    ]
  },

  fundidora_solar: {
    id: 'fundidora_solar',
    name: 'Fundidora Solar por Inducción',
    icon: '☀️',
    subtitle: 'Hornos de inducción magnética alimentados por helióstatos',
    recipes: [
      {
        id: 'rec_metal',
        name: 'Aleación de Acero Estructural',
        input: { chatarra_industrial: 2 },
        output: { acero_estructural: 1 },
        duration: 3.5
      },
      {
        id: 'rec_lithium',
        name: 'Purificación de Celdas de Litio',
        input: { baterias_degradadas: 1 },
        output: { litio_purificado: 2 },
        duration: 3.0
      }
    ]
  }
};

export class MachineManager {
  constructor(inventory, sound) {
    this.inventory = inventory;
    this.sound = sound;
    this.activeJobs = {}; // machineId -> { recipe, progress, totalTime }
  }

  isBusy(machineId) {
    return !!this.activeJobs[machineId];
  }

  getJob(machineId) {
    return this.activeJobs[machineId];
  }

  startJob(machineId, recipeId, onComplete, onTick) {
    if (this.isBusy(machineId)) return { success: false, reason: 'Máquina ocupada' };

    const machine = MACHINES[machineId];
    if (!machine) return { success: false, reason: 'Máquina desconocida' };

    const recipe = machine.recipes.find(r => r.id === recipeId);
    if (!recipe) return { success: false, reason: 'Receta no válida' };

    if (!this.inventory.hasMultiple(recipe.input)) {
      return { success: false, reason: 'Materiales insuficientes' };
    }

    // Deduct inputs
    this.inventory.removeMultiple(recipe.input);
    this.sound.playMachineStart();

    const job = {
      machineId,
      recipe,
      progress: 0,
      totalTime: recipe.duration,
      startTime: Date.now()
    };
    this.activeJobs[machineId] = job;

    const interval = 50; // update every 50ms
    const timer = setInterval(() => {
      const elapsed = (Date.now() - job.startTime) / 1000;
      job.progress = Math.min(1, elapsed / job.totalTime);

      if (onTick) onTick(job.progress);

      if (job.progress >= 1) {
        clearInterval(timer);
        delete this.activeJobs[machineId];

        // Add outputs to inventory
        Object.entries(recipe.output).forEach(([itemId, qty]) => {
          this.inventory.add(itemId, qty);
        });

        this.sound.playMachineDone();
        if (onComplete) onComplete(recipe);
      }
    }, interval);

    return { success: true };
  }
}
