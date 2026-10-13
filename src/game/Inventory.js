// Inventory and items management

export const ITEM_DEFS = {
  // RAW JUNK / SCRAP
  smartphones_viejos: {
    id: 'smartphones_viejos',
    name: 'Smartphones y Laptops en Desuso',
    icon: '📱',
    type: 'scrap',
    desc: 'E-Waste abundante en vertederos. Contiene circuitos con oro y silicio.'
  },
  placas_madre: {
    id: 'placas_madre',
    name: 'Placas de Circuito Rotas',
    icon: '🖲️',
    type: 'scrap',
    desc: 'Tarjetas madre quemadas con pistas de cobre puro de alta pureza.'
  },
  chatarra_industrial: {
    id: 'chatarra_industrial',
    name: 'Vigas y Chatarra Industrial',
    icon: '⚙️',
    type: 'scrap',
    desc: 'Hierro y metales pesados rescatados de fábricas abandonadas.'
  },
  neumaticos_gastados: {
    id: 'neumaticos_gastados',
    name: 'Neumáticos Viejos',
    icon: '🛞',
    type: 'scrap',
    desc: 'Caucho vulcanizado listo para despolimerizar y hacer asfalto ecológico.'
  },
  cables_enredados: {
    id: 'cables_enredados',
    name: 'Mazo de Cables Eléctricos',
    icon: '🔌',
    type: 'scrap',
    desc: 'Conductores forrados. Proveen cobre y polímeros aislantes.'
  },
  baterias_degradadas: {
    id: 'baterias_degradadas',
    name: 'Baterías de Litio Desechadas',
    icon: '🔋',
    type: 'scrap',
    desc: 'Peligrosas si se tiran, pero vitales para extraer sales de litio purificadas.'
  },

  // REFINED / TECH SUSTAINABLE MATERIALS
  cobre_puro: {
    id: 'cobre_puro',
    name: 'Cobre Puro Refinado',
    icon: '🔶',
    type: 'refined',
    desc: 'Metal conductor esencial para cableado de telecomunicaciones y bobinas.'
  },
  oro_refinado: {
    id: 'oro_refinado',
    name: 'Oro Tecnológico 24k',
    icon: '🟡',
    type: 'refined',
    desc: 'Conectores ultraconductores inmunes a la corrosión para antenas y microchips.'
  },
  silicio_grado_solar: {
    id: 'silicio_grado_solar',
    name: 'Silicio Grado Solar',
    icon: '🔷',
    type: 'refined',
    desc: 'Semiconductor procesado para celdas fotovoltaicas y procesadores IoT.'
  },
  caucho_ecologico: {
    id: 'caucho_ecologico',
    name: 'Caucho Recompuesto',
    icon: '⬛',
    type: 'refined',
    desc: 'Material elástico para mezclas de asfalto ecológico y aislantes acústicos.'
  },
  polimero_reforzado: {
    id: 'polimero_reforzado',
    name: 'Polímero Reforzado',
    icon: '🧪',
    type: 'refined',
    desc: 'Plástico de ingeniería reciclado de alta durabilidad para carcasas.'
  },
  acero_estructural: {
    id: 'acero_estructural',
    name: 'Acero Estructural Ecológico',
    icon: '🛡️',
    type: 'refined',
    desc: 'Aleación limpia fundida por inducción para torres y puentes.'
  },
  litio_purificado: {
    id: 'litio_purificado',
    name: 'Litio Purificado',
    icon: '⚡',
    type: 'refined',
    desc: 'Elemento clave para bancos de almacenamiento energético renovable.'
  }
};

export class Inventory {
  constructor() {
    this.items = {};
    // Starting starter kit with small amounts of scrap to let the player test immediately
    this.items = {
      smartphones_viejos: 2,
      chatarra_industrial: 2,
      neumaticos_gastados: 2,
      placas_madre: 1,
      cables_enredados: 1,
      baterias_degradadas: 1
    };
    this.listeners = [];
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.items));
  }

  get(id) {
    return this.items[id] || 0;
  }

  add(id, count = 1) {
    this.items[id] = (this.items[id] || 0) + count;
    this.notify();
    return this.items[id];
  }

  has(id, count = 1) {
    return (this.items[id] || 0) >= count;
  }

  hasMultiple(requirements) {
    return Object.entries(requirements).every(([id, count]) => this.has(id, count));
  }

  remove(id, count = 1) {
    if (!this.has(id, count)) return false;
    this.items[id] -= count;
    if (this.items[id] <= 0) {
      delete this.items[id];
    }
    this.notify();
    return true;
  }

  removeMultiple(requirements) {
    if (!this.hasMultiple(requirements)) return false;
    Object.entries(requirements).forEach(([id, count]) => {
      this.remove(id, count);
    });
    return true;
  }

  getAll() {
    return { ...this.items };
  }
}
