// ODS 9 Missions catalog, requirements, and world progression

export const MISSIONS_DATA = [
  {
    id: 'mission_1_wifi',
    code: 'ODS9-01',
    title: 'Antena WiFi Rural de Alta Cobertura',
    subtitle: 'Comunidad de la Montaña aislada',
    story: 'Los habitantes del poblado alto quedaron incomunicados tras el colapso de las viejas líneas telefónicas. Necesitan conexión a internet para telemedicina, escuelas y emergencias climáticas. Fabrica y erige una antena de microondas con componentes de telecomunicación recuperados.',
    requirements: {
      cobre_puro: 2,
      oro_refinado: 1,
      polimero_reforzado: 1
    },
    rewards: {
      clean: 15,
      tech: 35,
      infra: 15
    },
    worldObject: 'wifi_tower'
  },
  {
    id: 'mission_2_road',
    code: 'ODS9-02',
    title: 'Carretera Inteligente con Asfalto de Caucho',
    subtitle: 'Vía principal destruida por erosión',
    story: 'La carretera de acceso está intransitable y bloqueada por escombros industriales. Usando neumáticos triturados combinados con acero reciclado y sensores IoT, podemos crear una calzada silenciosa, drenante y monitoreada en tiempo real.',
    requirements: {
      caucho_ecologico: 4,
      acero_estructural: 1,
      silicio_grado_solar: 1
    },
    rewards: {
      clean: 20,
      tech: 15,
      infra: 35
    },
    worldObject: 'eco_road'
  },
  {
    id: 'mission_3_solar',
    code: 'ODS9-03',
    title: 'Microcentral Solar & Banco de Litio Reacondicionado',
    subtitle: 'Sustitución de generadores diésel contaminantes',
    story: 'El valle depende de generadores a combustible fósil que emiten hollín continuo. Con el silicio extraído de paneles y dispositivos rotos, más las celdas de litio purificadas en los hornos solares, energizaremos toda la zona con energía renovable.',
    requirements: {
      silicio_grado_solar: 3,
      litio_purificado: 2,
      cobre_puro: 2
    },
    rewards: {
      clean: 30,
      tech: 20,
      infra: 30
    },
    worldObject: 'solar_farm'
  },
  {
    id: 'mission_4_iot',
    code: 'ODS9-04',
    title: 'Red de Boyas IoT & Sensores Ambientales Fluviales',
    subtitle: 'Monitoreo preventivo del afluente hídrico',
    story: 'El río cercano sufre de vertidos químicos pasados. Construye estaciones de telemetría flotantes alimentadas por microceldas solares y chips de oro para detectar contaminantes y asegurar agua limpia para las comunidades río abajo.',
    requirements: {
      oro_refinado: 2,
      silicio_grado_solar: 2,
      polimero_reforzado: 2
    },
    rewards: {
      clean: 25,
      tech: 30,
      infra: 15
    },
    worldObject: 'river_sensors'
  },
  {
    id: 'mission_5_bridge',
    code: 'ODS9-05',
    title: 'Viaducto de Acero Ecológico & Tren Eléctrico',
    subtitle: 'Integración industrial metropolitana ODS 9',
    story: 'El gran proyecto maestro: construir un puente ferroviario sustentable con acero circular fundido por inducción solar y catenarias de cobre reciclado, conectando la región recuperada con el corredor bioceánico sostenible.',
    requirements: {
      acero_estructural: 3,
      cobre_puro: 3,
      litio_purificado: 2
    },
    rewards: {
      clean: 20,
      tech: 35,
      infra: 40
    },
    worldObject: 'mega_bridge'
  }
];

export class MissionManager {
  constructor(inventory, sound) {
    this.inventory = inventory;
    this.sound = sound;
    this.missions = MISSIONS_DATA;
    this.activeMissionIndex = 0;
    this.completedMissions = new Set();
    
    // Region indicators (0 - 100)
    this.metrics = {
      clean: 10,
      tech: 0,
      infra: 5
    };
    
    this.listeners = [];
  }

  getActiveMission() {
    return this.missions[this.activeMissionIndex] || null;
  }

  setActiveMission(index) {
    if (index >= 0 && index < this.missions.length) {
      this.activeMissionIndex = index;
      this.notify();
    }
  }

  isMissionCompleted(id) {
    return this.completedMissions.has(id);
  }

  canCompleteActive() {
    const active = this.getActiveMission();
    if (!active || this.isMissionCompleted(active.id)) return false;
    return this.inventory.hasMultiple(active.requirements);
  }

  completeActiveMission() {
    const active = this.getActiveMission();
    if (!this.canCompleteActive()) return { success: false };

    // Deduct requirements
    this.inventory.removeMultiple(active.requirements);
    this.completedMissions.add(active.id);

    // Boost metrics
    this.metrics.clean = Math.min(100, this.metrics.clean + active.rewards.clean);
    this.metrics.tech = Math.min(100, this.metrics.tech + active.rewards.tech);
    this.metrics.infra = Math.min(100, this.metrics.infra + active.rewards.infra);

    // Auto-advance to next incomplete mission if possible
    const nextIdx = this.missions.findIndex(m => !this.completedMissions.has(m.id));
    if (nextIdx !== -1) {
      this.activeMissionIndex = nextIdx;
    }

    this.sound.playMissionCelebration();
    this.notify();

    return {
      success: true,
      mission: active,
      worldObject: active.worldObject,
      metrics: { ...this.metrics },
      allDone: this.completedMissions.size === this.missions.length
    };
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this));
  }
}
