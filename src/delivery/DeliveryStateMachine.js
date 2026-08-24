import { EventBus } from '../core/EventBus.js';

export const DeliveryState = {
  IDLE: 'IDLE',
  OFFER: 'OFFER',
  TO_PICKUP: 'TO_PICKUP',
  PARKED_PICKUP: 'PARKED_PICKUP',
  ON_FOOT_PICKUP: 'ON_FOOT_PICKUP',
  COLLECTING: 'COLLECTING',
  RETURNING: 'RETURNING',
  TO_CUSTOMER: 'TO_CUSTOMER',
  PARKED_CUSTOMER: 'PARKED_CUSTOMER',
  ON_FOOT_CUSTOMER: 'ON_FOOT_CUSTOMER',
  COMPLETE: 'COMPLETE'
};

const ACTIVE_STATES = new Set([
  DeliveryState.TO_PICKUP,
  DeliveryState.PARKED_PICKUP,
  DeliveryState.ON_FOOT_PICKUP,
  DeliveryState.COLLECTING,
  DeliveryState.RETURNING,
  DeliveryState.TO_CUSTOMER,
  DeliveryState.PARKED_CUSTOMER,
  DeliveryState.ON_FOOT_CUSTOMER
]);

const TRANSITIONS = {
  [DeliveryState.IDLE]: [],
  [DeliveryState.OFFER]: ['accept', 'decline'],
  [DeliveryState.TO_PICKUP]: ['arrivePickup', 'fail'],
  [DeliveryState.PARKED_PICKUP]: ['beginWalkPickup', 'fail'],
  [DeliveryState.ON_FOOT_PICKUP]: ['enterBuilding', 'boardVehicle', 'fail'],
  [DeliveryState.COLLECTING]: ['collectFood', 'leaveBuilding', 'fail'],
  [DeliveryState.RETURNING]: ['boardVehicle', 'fail'],
  [DeliveryState.TO_CUSTOMER]: ['arriveCustomer', 'fail'],
  [DeliveryState.PARKED_CUSTOMER]: ['beginWalkCustomer', 'fail'],
  [DeliveryState.ON_FOOT_CUSTOMER]: ['complete', 'fail'],
  [DeliveryState.COMPLETE]: []
};

export class DeliveryStateMachine {
  constructor(bus = new EventBus()) {
    this.bus = bus;
    this.state = DeliveryState.IDLE;
    this.delivery = null;
    this.hasFood = false;
    this.timeLeft = 0;
    this.timeLimit = 1;
    this.stats = { completed: 0, failed: 0, earnedToday: 0 };
  }

  get isActive() {
    return ACTIVE_STATES.has(this.state);
  }

  get isOnFootStage() {
    return (
      this.state === DeliveryState.ON_FOOT_PICKUP ||
      this.state === DeliveryState.COLLECTING ||
      this.state === DeliveryState.RETURNING ||
      this.state === DeliveryState.ON_FOOT_CUSTOMER
    );
  }

  get timeRemainingFrac() {
    return this.timeLeft / this.timeLimit;
  }

  _can(action) {
    return TRANSITIONS[this.state].includes(action);
  }

  _set(state) {
    this.state = state;
    this.bus.emit('delivery:changed', { state, delivery: this.delivery });
  }

  offer(delivery) {
    if (this.isActive || this.state === DeliveryState.OFFER) return false;
    this.delivery = delivery;
    this.hasFood = false;
    this._set(DeliveryState.OFFER);
    this.bus.emit('delivery:offered', { delivery });
    return true;
  }

  accept() {
    if (!this._can('accept')) return false;
    this.timeLimit = this.delivery.timeLimitSec;
    this.timeLeft = this.timeLimit;
    this._set(DeliveryState.TO_PICKUP);
    this.bus.emit('delivery:accepted', { delivery: this.delivery });
    return true;
  }

  decline() {
    if (!this._can('decline')) return false;
    this.delivery = null;
    this._set(DeliveryState.IDLE);
    this.bus.emit('delivery:declined', {});
    return true;
  }

  arrivePickup() {
    if (!this._can('arrivePickup')) return false;
    this._set(DeliveryState.PARKED_PICKUP);
    return true;
  }

  beginWalkPickup() {
    if (!this._can('beginWalkPickup')) return false;
    this._set(DeliveryState.ON_FOOT_PICKUP);
    return true;
  }

  enterBuilding() {
    if (!this._can('enterBuilding')) return false;
    this._set(DeliveryState.COLLECTING);
    return true;
  }

  collectFood() {
    if (!this._can('collectFood')) return false;
    this.hasFood = true;
    this._set(DeliveryState.RETURNING);
    this.bus.emit('delivery:foodCollected', { delivery: this.delivery });
    return true;
  }

  leaveBuilding() {
    if (!this._can('leaveBuilding')) return false;
    this._set(DeliveryState.ON_FOOT_PICKUP);
    return true;
  }

  boardVehicle() {
    if (this.state === DeliveryState.ON_FOOT_PICKUP && this._can('boardVehicle')) {
      this._set(DeliveryState.TO_PICKUP);
      return true;
    }
    if (this.state === DeliveryState.RETURNING && this._can('boardVehicle')) {
      this._set(DeliveryState.TO_CUSTOMER);
      this.bus.emit('delivery:drivingToCustomer', { delivery: this.delivery });
      return true;
    }
    return false;
  }

  arriveCustomer() {
    if (!this._can('arriveCustomer')) return false;
    this._set(DeliveryState.PARKED_CUSTOMER);
    return true;
  }

  beginWalkCustomer() {
    if (!this._can('beginWalkCustomer')) return false;
    this._set(DeliveryState.ON_FOOT_CUSTOMER);
    return true;
  }

  complete(payout) {
    if (!this._can('complete')) return false;
    const d = this.delivery;
    this.stats.completed++;
    this.stats.earnedToday += payout.total;
    this._set(DeliveryState.COMPLETE);
    this.bus.emit('delivery:delivered', { delivery: d, payout });
    this.delivery = null;
    this.hasFood = false;
    return true;
  }

  fail(reason) {
    if (!this.isActive) return false;
    const d = this.delivery;
    this.stats.failed++;
    this._set(DeliveryState.IDLE);
    this.bus.emit('delivery:failed', { reason, delivery: d });
    this.delivery = null;
    this.hasFood = false;
    return true;
  }

  update(dt) {
    if (!this.isActive) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.fail('timeout');
    }
  }
}
