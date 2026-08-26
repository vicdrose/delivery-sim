export const CONFIG = {
  render: {
    maxPixelRatio: 2,
    fov: 62,
    shadowMapSize: 2048,
    shadowRadius: 90
  },

  city: {
    seed: 20260824,
    gridN: 6,
    blockSize: 46,
    roadWidth: 12,
    sidewalkWidth: 3.4,
    laneLineEvery: 6,
    lampSpacing: 22,
    treeChance: 0.55,
    boundaryWallPadding: 2,

    zoneOf(col, row) {
      const n = this.gridN;
      const c = Math.min(col, n - 1 - col);
      const r = Math.min(row, n - 1 - row);
      const ring = Math.min(c, r);
      if (ring >= 2) return 'business';
      if (col >= n - 2 && row <= 1) return 'campus';
      if (ring === 1) return 'commercial';
      return 'residential';
    }
  },

  vehicle: {
    accel: 15.0,
    maxSpeed: 40.5,
    maxReverse: 9,
    brakeForce: 32,
    engineBrake: 3.2,
    dragCoef: 0.004,
    steerRateLow: 2.55,
    steerRateHigh: 1.05,
    steerFadeSpeed: 17,
    minTurnSpeed: 0.6,
    gripLateral: 6.5,
    gripHandbrake: 1.7,
    handbrakeDecel: 9,
    bodyWidth: 2.0,
    bodyLength: 4.3,
    collisionRadius: 1.25,
    parkedSpeedThreshold: 0.6,
    parkedDwellTime: 0.7
  },

  player: {
    walkSpeed: 4.6,
    sprintSpeed: 7.6,
    radius: 0.42,
    turnLerp: 14
  },

  camera: {
    carDist: 9.6,
    carHeight: 4.8,
    carLookAhead: 7.5,
    footDist: 5.4,
    footHeight: 2.9,
    interiorAngle: 0.62,
    smoothPos: 5.5,
    smoothLook: 7.0,
    speedFovBoost: 11
  },

  interaction: {
    defaultRadius: 2.8,
    vehicleEnterRadius: 3.6
  },

  parking: {
    arriveRadius: 15,
    dropoffRadius: 14
  },

  day: {
    lengthSeconds: 480,
    startTime: 0.12,
    dayStartHour: 6,
    windowGlowInStart: 0.72,
    windowGlowInEnd: 0.80,
    windowGlowOutEnd: 0.06,

    phases: [
      { t: 0.00, name: 'Dawn',      sky: '#ff9e73', fog: '#ffc09e', sun: '#ffcf9e', sunI: 0.55, ambI: 0.48, elev: 10, azim: 105 },
      { t: 0.10, name: 'Morning',   sky: '#8ecae6', fog: '#cfe8f5', sun: '#fff3d6', sunI: 1.20, ambI: 0.58, elev: 35, azim: 145 },
      { t: 0.35, name: 'Midday',    sky: '#79c4ea', fog: '#d6ecf7', sun: '#ffffff', sunI: 1.38, ambI: 0.66, elev: 72, azim: 205 },
      { t: 0.55, name: 'Afternoon', sky: '#85c1e5', fog: '#d8e6ee', sun: '#ffe9c4', sunI: 1.05, ambI: 0.56, elev: 40, azim: 255 },
      { t: 0.68, name: 'Golden Hour', sky: '#f4a26b', fog: '#f7c493', sun: '#ffb26b', sunI: 0.82, ambI: 0.48, elev: 17, azim: 282 },
      { t: 0.76, name: 'Dusk',      sky: '#7a5d8e', fog: '#9a7aa0', sun: '#ff8f66', sunI: 0.34, ambI: 0.40, elev: 6,  azim: 296 },
      { t: 0.84, name: 'Night',     sky: '#111a2e', fog: '#1a2438', sun: '#9fb6de', sunI: 0.22, ambI: 0.24, elev: 48, azim: 60 },
      { t: 1.00, name: 'Dawn',      sky: '#ff9e73', fog: '#ffc09e', sun: '#ffcf9e', sunI: 0.55, ambI: 0.48, elev: 10, azim: 105 }
    ]
  },

  economy: {
    baseFare: 3.5,
    perMile: 2.75,
    tipMin: 0.5,
    tipMax: 3.25,
    timeSlackMult: 1.65,
    serviceSeconds: 70,
    driveSpeedAssumption: 11,
    currency: '$'
  },

  gas: {
    tankSize: 40,
    consumptionRate: 0.18,
    refillRadius: 4.5,
    refillCostPerUnit: 0.85
  },

  audio: {
    masterVolume: 0.8,
    engineBaseFreq: 36,
    engineFreqRange: 74,
    engineMaxGain: 0.0225
  },

  controlsHelp: [
    ['W / ↑', 'Accelerate'],
    ['S / ↓', 'Brake / Reverse'],
    ['A D / ← →', 'Steer'],
    ['Space', 'Handbrake'],
    ['E', 'Interact'],
    ['F', 'Enter / Exit vehicle'],
    ['Shift', 'Sprint (on foot)'],
    ['H', 'Horn'],
    ['M', 'Mute sound'],
    ['R', 'Radio: tap next · hold power'],
    ['Esc', 'Pause'],
    ['Gamepad', 'RT gas · LT brake · Stick steer · A interact / accept · Y vehicle · RB handbrake · X horn · LB radio']
  ]
};

export function metersToMiles(m) {
  return m * 0.000621371;
}

export function formatMoney(n) {
  const neg = n < 0;
  const v = Math.abs(n);
  const s = v.toFixed(2);
  return (neg ? '-$' : '$') + s;
}

export function formatClock(t) {
  const hours24 = (CONFIG.day.dayStartHour + t * 24) % 24;
  const h = Math.floor(hours24);
  const m = Math.floor((hours24 - h) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
