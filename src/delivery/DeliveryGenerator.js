import { RNG } from '../core/RNG.js';
import { CONFIG, metersToMiles } from '../config.js';
import { FOOD_ITEMS } from '../city/names.js';

function round25(n) {
  return Math.round(n * 4) / 4;
}

/**
 * @typedef {Object} Delivery
 * @property {string} id
 * @property {string} foodItem
 * @property {{id:string,name:string,pos:THREE.Vector3,parkPos:THREE.Vector3}} pickup
 * @property {{id:string,name:string,pos:THREE.Vector3,parkPos:THREE.Vector3}} dropoff
 * @property {number} distanceM
 * @property {number} distanceMiles
 * @property {number} payBase
 * @property {number} tipEstimate
 * @property {number} totalEstimate
 * @property {number} timeLimitSec
 */

export class DeliveryGenerator {
  constructor(locations) {
    this.locations = locations;
  }

  /**
   * @returns {Delivery|null}
   */
  create(excludePickupId = null) {
    const rng = new RNG((Math.random() * 0xffffffff) >>> 0);
    const pickup = this.locations.randomOf('food', rng, excludePickupId);
    if (!pickup) return null;
    let dropoff = this.locations.randomOf('home', rng);
    if (!dropoff || dropoff.id === pickup.id) {
      dropoff = this.locations.randomOf('food', rng, pickup.id);
    }
    if (!dropoff) return null;

    const manhattan = this.locations.roadDistance(pickup, dropoff);
    const straight = pickup.door.distanceTo(dropoff.door);
    const distanceM = Math.max(manhattan * 0.85 + straight * 0.35, straight * 1.15);

    const miles = metersToMiles(distanceM);
    const eco = CONFIG.economy;
    const payBase = round25(eco.baseFare + miles * eco.perMile);
    const tipEstimate = round25(rng.float(eco.tipMin, eco.tipMax));

    const driveSec = distanceM / eco.driveSpeedAssumption;
    const timeLimitSec = Math.round(driveSec * eco.timeSlackMult + eco.serviceSeconds * 1.6 + 50);

    return {
      id: 'd' + Math.floor(rng.float(1e8, 1e9)).toString(36),
      foodItem: rng.pick(FOOD_ITEMS),
      pickup: { id: pickup.id, name: pickup.name, pos: pickup.door, parkPos: pickup.parkPos, poi: pickup },
      dropoff: { id: dropoff.id, name: dropoff.name, pos: dropoff.door, parkPos: dropoff.parkPos, poi: dropoff },
      distanceM,
      distanceMiles: miles,
      payBase,
      tipEstimate,
      totalEstimate: round25(payBase + tipEstimate),
      timeLimitSec
    };
  }

  /** @returns {{base:number, tip:number, bonus:number, total:number, onTime:boolean}} */
  finalize(delivery, timeRemainingFrac) {
    const onTime = timeRemainingFrac > 0;
    const frac = THREE_compatClamp01((timeRemainingFrac - 0.05) / 0.45);
    const tip = round25(delivery.tipEstimate * (onTime ? 0.6 + 0.6 * frac : 0.25));
    const bonus = onTime && frac > 0.85 ? 1 : 0;
    return {
      base: delivery.payBase,
      tip,
      bonus,
      total: round25(delivery.payBase + tip + bonus),
      onTime
    };
  }
}

function THREE_compatClamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
