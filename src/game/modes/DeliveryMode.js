import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { bus } from '../../core/bus.js';
import { DeliveryState } from '../../delivery/DeliveryStateMachine.js';
import { makeMarkerMaterial } from '../../city/materials.js';
import { ui, toast, showPayment, showBagSecured, showShiftFlash } from '../../ui/store.js';

const fmtTime = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class DeliveryMode {
  constructor(ctx) {
    this.g = ctx;
    this.playerMode = 'drive';
    this.camYawFoot = 0;
    this.offerTimer = this._nextOfferWait();
    this._offerExpiry = -1;
    this._shiftActive = true;
    this._shiftHoldTimer = 0;
    this.completeTimer = -1;
    this.lastPickupId = null;
    this._unsubs = [];
    this._tempItems = [];
    this._time = 0;
    this._minimapClock = 0;

    this.targetPos = null;
    this._showCarBeacon = false;
    this._fuelWarned = false;

    const beamMat = makeMarkerMaterial('#ffd23f', 0.20);
    const ringMat = makeMarkerMaterial('#ffd23f', 0.5);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 30, 16, 1, true), beamMat);
    this.beam.position.y = 15;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.16, 8, 32), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.35;
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.add(this.beam, this.ring);
    this.beaconGroup.visible = false;
    ctx.scene.add(this.beaconGroup);
    this.beamMat = beamMat;
    this.ringMat = ringMat;

    this.doorstepBag = this._buildDoorstepBag();
    this.doorstepBag.visible = false;
    ctx.scene.add(this.doorstepBag);
  }

  enter() {
    const g = this.g;
    const sp = g.city.spawn;
    g.vehicle.reset(sp.x + 6, sp.z - 5, Math.PI);
    g.vehicle.onCrash = (i) => {
      g.cameraRig.shake(i);
      g.audio.play('crash');
    };
    g.vehicle.onSkid = (a) => g.audio.setSkid(a);
    g.player.teleport(sp.x, sp.z, Math.PI);
    g.player.setVisible(true);
    this.playerMode = 'foot';
    this.camYawFoot = Math.PI;
    g.cameraRig.setMode('foot');
    g.cameraRig.snapBehind(g.player.pos, this.camYawFoot);
    this.offerTimer = 1.2;
    this.lastPickupId = null;
    this._showCarBeacon = true;

    this._registerDoorItems();

    this._unsubs.push(
      bus.on('delivery:offered', ({ delivery }) => {
        ui.offer = {
          id: delivery.id,
          pickupName: delivery.pickup.name,
          dropName: delivery.dropoff.name,
          miles: delivery.distanceMiles.toFixed(1) + ' mi',
          pay: '$' + delivery.payBase.toFixed(2),
          tip: '~$' + delivery.tipEstimate.toFixed(2),
          total: '$' + delivery.totalEstimate.toFixed(2),
          time: fmtTime(delivery.timeLimitSec),
          foodItem: delivery.foodItem
        };
        g.audio.play('notify');
      }),
      bus.on('delivery:accepted', () => {
        ui.offer = null;
        g.audio.play('accept');
        toast('Order accepted. Get it while it is hot!', 'success');
      }),
      bus.on('delivery:declined', () => {
        ui.offer = null;
        this.offerTimer = 1.0;
      }),
      bus.on('delivery:foodCollected', () => {
        g.audio.play('pickup');
        g.interiors.hideCounterBag();
        g.player.setHoldingBag(true);
        showBagSecured(this._short(this.fsmDelivery.foodItem));
      }),
      bus.on('delivery:drivingToCustomer', () => {
        toast('Deliver it before it gets cold!', 'info');
      }),
      bus.on('delivery:delivered', ({ payout }) => {
        g.progression.addMoney(payout.total);
        g.progression.recordDelivery(true);
        ui.money = g.progression.profile.bank;
        ui.todayEarned += payout.total;
        ui.deliveriesToday++;
        g.audio.play('deliver');
        g.audio.play('cash');
        showPayment(payout.total, payout.onTime);
        this.completeTimer = 2.6;
      }),
      bus.on('delivery:failed', ({ reason }) => {
        g.progression.recordDelivery(false);
        g.player.setHoldingBag(false);
        g.audio.play('fail');
        toast(
          reason === 'timeout' ? 'Too slow! The customer canceled the order.' : 'Order failed.',
          'danger',
          4200
        );
        this.lastPickupId = null;
        this.offerTimer = 3.5;
      }),
      bus.on('day:ended', ({ day }) => {
        g.progression.endDay();
        g.audio.play('dayEnd');
        toast(`Day ${day - 1} wrapped. The grind never sleeps!`, 'info', 5000);
      })
    );

    ui.money = g.progression.profile.bank;
    ui.todayEarned = 0;
    ui.deliveriesToday = 0;
  }

  get fsmDelivery() {
    return this.g.fsm.delivery || {};
  }

  _short(name) {
    return name.length > 26 ? name.slice(0, 24) + '…' : name;
  }

  _registerDoorItems() {
    const g = this.g;
    for (const poi of g.city.locations.pois) {
      if (poi.category === 'food') {
        g.interaction.add({
          position: poi.door,
          radius: 3.2,
          label: () => {
            if (this.playerMode !== 'foot') return null;
            const d = g.fsm.delivery;
            if (d && d.pickup.id === poi.id && g.fsm.state === DeliveryState.ON_FOOT_PICKUP) {
              return `Enter ${poi.name}`;
            }
            return `Enter ${poi.name}`;
          },
          action: () => this._enterBuilding(poi)
        });
      } else if (poi.category === 'home') {
        g.interaction.add({
          position: poi.door,
          radius: 3.4,
          label: () => {
            if (this.playerMode !== 'foot') return null;
            const d = g.fsm.delivery;
            if (d && d.dropoff.id === poi.id && g.fsm.hasFood) {
              const st = g.fsm.state;
              if (
                st === DeliveryState.ON_FOOT_CUSTOMER ||
                st === DeliveryState.PARKED_CUSTOMER ||
                st === DeliveryState.TO_CUSTOMER
              ) {
                return 'Deliver Order';
              }
            }
            return null;
          },
          action: () => this._deliverAtDoor(poi)
        });
      } else if (poi.category === 'gas') {
        g.interaction.add({
          position: poi.door,
          radius: CONFIG.gas.refillRadius,
          label: () => {
            if (this.playerMode !== 'foot') return null;
            if (g.vehicle.fuelLevel >= g.vehicle.fuelMax) return null;
            return 'Refuel Car';
          },
          action: () => this._refuelAtStation(poi)
        });
      }
    }
  }

  _enterBuilding(poi) {
    const g = this.g;
    g.audio.play('door');
    this.doorstepBag.visible = false;
    const res = g.interiors.enter(poi, g.player.pos.clone());
    this.playerMode = 'inside';
    g.player.teleport(res.entryPos.x, res.entryPos.z, Math.PI);
    g.cameraRig.setMode('interior');
    g.cameraRig.snapBehind(g.player.pos, Math.PI);

    const isTarget = () => {
      const d = g.fsm.delivery;
      return d && d.pickup.id === poi.id;
    };

    this._clearTempItems();
    this._tempItems.push(
      g.interaction.add({
        position: res.exitAnchor,
        radius: 2.2,
        label: () => (this.playerMode === 'inside' ? 'Leave' : null),
        action: () => this._exitBuilding()
      }),
      g.interaction.add({
        position: new THREE.Vector3(res.entryPos.x + 2.6, 0, res.entryPos.z - 5.2),
        radius: 2.6,
        label: () => {
          if (this.playerMode !== 'inside') return null;
          if (isTarget() && g.fsm.state === DeliveryState.COLLECTING) return 'Pick Up Order';
          if (isTarget() && g.fsm.state === DeliveryState.ON_FOOT_PICKUP) return 'Talk to Staff';
          return 'Browse Menu';
        },
        action: () => {
          const fsm = g.fsm;
          if (isTarget() && fsm.state === DeliveryState.COLLECTING) {
            fsm.collectFood();
          } else if (isTarget()) {
            if (fsm.enterBuilding()) toast('The staff is whipping it up...', 'info');
          } else {
            toast('Smells amazing. Maybe after your shift.', 'info');
            g.audio.play('ui');
          }
        }
      })
    );

    if (isTarget() && g.fsm.state === DeliveryState.ON_FOOT_PICKUP) {
      g.fsm.enterBuilding();
    } else if (isTarget()) {
      const st = g.fsm.state;
      if (st === DeliveryState.TO_PICKUP || st === DeliveryState.PARKED_PICKUP) {
        g.fsm.arrivePickup();
        g.fsm.beginWalkPickup();
        g.fsm.enterBuilding();
      }
    } else if (!isTarget()) {
      toast(`You step into ${poi.name}.`, 'info', 2200);
    }
    if (isTarget()) {
      g.interiors.showCounterBag();
    }
    ui.insideName = poi.name;
  }

  _exitBuilding() {
    const g = this.g;
    const wasCollecting = g.fsm.state === DeliveryState.COLLECTING;
    const { returnPos } = g.interiors.exit();
    this._clearTempItems();
    g.player.teleport(returnPos.x, returnPos.z, g.player.yaw);
    this.playerMode = 'foot';
    g.cameraRig.setMode('foot');
    g.cameraRig.snapBehind(g.player.pos, this.camYawFoot);
    ui.insideName = null;
    g.audio.play('door');
    if (wasCollecting) g.fsm.leaveBuilding();
  }

  _deliverAtDoor(poi) {
    const g = this.g;
    const fsm = g.fsm;
    const d = fsm.delivery;
    if (!d || d.dropoff.id !== poi.id || !fsm.hasFood) {
      toast('Nobody here ordered anything...', 'info');
      return;
    }
    const st = fsm.state;
    if (st === DeliveryState.TO_CUSTOMER) {
      fsm.arriveCustomer();
      fsm.beginWalkCustomer();
    } else if (st === DeliveryState.PARKED_CUSTOMER) {
      fsm.beginWalkCustomer();
    }
    if (fsm.state !== DeliveryState.ON_FOOT_CUSTOMER) {
      toast('Grab the order from the restaurant first!', 'info');
      return;
    }
    g.player.setHoldingBag(false);
    const bld = poi.buildingAABB;
    let offX = 0;
    let offZ = 2.5;
    if (bld) {
      const dx = poi.door.x - bld.cx;
      const dz = poi.door.z - bld.cz;
      const len = Math.hypot(dx, dz) || 1;
      offX = (dx / len) * 2.5;
      offZ = (dz / len) * 2.5;
    }
    this.doorstepBag.position.set(poi.door.x + offX, 0, poi.door.z + offZ);
    this.doorstepBag.visible = true;
    const payout = g.generator.finalize(d, fsm.timeRemainingFrac);
    fsm.complete(payout);
  }

  _refuelAtStation() {
    const g = this.g;
    const veh = g.vehicle;
    const missing = veh.fuelMax - veh.fuelLevel;
    if (missing <= 0) {
      toast('Tank is already full!', 'info');
      return;
    }
    const cost = missing * CONFIG.gas.refillCostPerUnit;
    if (g.progression.profile.bank < cost) {
      toast('Not enough money to refuel!', 'danger');
      return;
    }
    g.progression.addMoney(-cost);
    ui.money = g.progression.profile.bank;
    veh.refuel(missing);
    g.audio.play('cash');
    toast(`Refueled! -$${cost.toFixed(2)}`, 'success');
  }

  _clearTempItems() {
    for (const off of this._tempItems) off();
    this._tempItems = [];
  }

  _buildDoorstepBag() {
    const g = new THREE.Group();
    const bagMat = new THREE.MeshLambertMaterial({ color: '#c9915a' });
    const receiptMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.24), bagMat);
    body.position.y = 0.19;
    body.castShadow = true;
    g.add(body);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.06), bagMat);
    flap.position.set(0, 0.4, -0.09);
    g.add(flap);
    const receipt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.01), receiptMat);
    receipt.position.set(0, 0.22, 0.125);
    g.add(receipt);
    return g;
  }

  _exitVehicle() {
    const g = this.g;
    const pos = g.vehicle.exitPosition();
    g.collision.resolveCircle(pos, 0.5, 'city');
    g.player.teleport(pos.x, pos.z, g.vehicle.heading);
    g.player.setVisible(true);
    this.playerMode = 'foot';
    this.camYawFoot = g.player.yaw;
    g.cameraRig.setMode('foot');
    g.cameraRig.snapBehind(g.player.pos, this.camYawFoot);
    g.audio.play('exit');
    g.audio.setEngine(0, 0, false);
    g.music.pauseForFoot();
    this._checkWalkingArrival();
  }

  _enterVehicle() {
    const g = this.g;
    g.player.setVisible(false);
    this.playerMode = 'drive';
    this._showCarBeacon = false;
    g.cameraRig.setMode('car');
    g.cameraRig.snapBehind(g.vehicle.position, g.vehicle.heading);
    g.audio.play('enter');
    g.music.resumeInCar();
    g.fsm.boardVehicle();
  }

  _checkWalkingArrival() {
    const g = this.g;
    const fsm = g.fsm;
    const d = fsm.delivery;
    if (!d) return;
    const vp = g.vehicle.position;
    const pp = g.player.pos;
    if (fsm.state === DeliveryState.TO_PICKUP) {
      const nearPark = vp.distanceTo(d.pickup.parkPos) < CONFIG.parking.arriveRadius;
      const nearDoor = pp.distanceTo(d.pickup.pos) < CONFIG.parking.arriveRadius * 1.4;
      if (nearPark || nearDoor) {
        fsm.arrivePickup();
        fsm.beginWalkPickup();
      }
    } else if (fsm.state === DeliveryState.PARKED_PICKUP) {
      if (pp.distanceTo(d.pickup.pos) < CONFIG.parking.arriveRadius * 1.4) fsm.beginWalkPickup();
    } else if (fsm.state === DeliveryState.PARKED_CUSTOMER) {
      if (pp.distanceTo(d.dropoff.pos) < CONFIG.parking.arriveRadius * 1.4) fsm.beginWalkCustomer();
    } else if (fsm.state === DeliveryState.TO_CUSTOMER && fsm.hasFood) {
      if (pp.distanceTo(d.dropoff.pos) < CONFIG.parking.arriveRadius * 1.4) {
        fsm.arriveCustomer();
        fsm.beginWalkCustomer();
      }
    }
  }

  update(dt, s) {
    const g = this.g;
    this._time += dt;

    if ((s.interactPressed || s.acceptPressed) && g.fsm.state === DeliveryState.OFFER) {
      g.fsm.accept();
    }
    if (s.declinePressed && g.fsm.state === DeliveryState.OFFER) {
      g.fsm.decline();
    }

    const veh = g.vehicle;

    if (this.playerMode === 'drive') {
      veh.setBrakeLights(s.brake > 0 || s.handbrake);
      veh.update(dt, { steer: s.steer, throttle: s.throttle, brake: s.brake, handbrake: s.handbrake });
      g.audio.horn(s.horn);
      g.audio.setEngine(
        Math.min(1, Math.abs(veh.speed) / CONFIG.vehicle.maxSpeed),
        s.throttle,
        true
      );
      if (s.enterExitPressed && Math.abs(veh.speed) < 1.6) {
        this._exitVehicle();
      }
      const fsm = g.fsm;
      const d = fsm.delivery;
      if (d && veh.isParkedStill) {
        const vp = veh.position;
        if (
          fsm.state === DeliveryState.TO_PICKUP &&
          vp.distanceTo(d.pickup.parkPos) < CONFIG.parking.arriveRadius
        ) {
          fsm.arrivePickup();
          g.audio.play('notify');
          toast('Parked! Hop out and grab the order.', 'info');
        } else if (
          fsm.state === DeliveryState.TO_CUSTOMER &&
          vp.distanceTo(d.dropoff.parkPos) < CONFIG.parking.arriveRadius
        ) {
          fsm.arriveCustomer();
          g.audio.play('notify');
          toast('Parked! Walk it over to the door.', 'info');
        }
      }
    } else if (this.playerMode === 'foot') {
      const forward = s.moveForward;
      const strafe = s.steer;
      const camYaw = this.camYawFoot + g.cameraRig.orbitYaw;
      g.player.update(dt, strafe, forward, s.sprint, camYaw, g.collision, 'city');
      const moving = forward !== 0 || strafe !== 0;
      if (moving) {
        let diff = g.player.yaw - this.camYawFoot;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.camYawFoot += diff * Math.min(1, 2.2 * dt);
      }
      g.audio.horn(false);
      g.audio.setEngine(0, 0, false);
      g.audio.setSkid(0);
      if (s.enterExitPressed) {
        const dp = g.player.pos.distanceTo(veh.position);
        if (dp < CONFIG.interaction.vehicleEnterRadius && Math.abs(veh.speed) < 1.6) {
          this._enterVehicle();
        }
      }
      this._checkWalkingArrival();
    } else {
      const forward = s.moveForward;
      const strafe = s.steer;
      const camYaw = this.camYawFoot + g.cameraRig.orbitYaw;
      g.player.update(dt, strafe, forward, s.sprint, camYaw, g.collision, 'interior');
      let diff = g.player.yaw - this.camYawFoot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (forward !== 0 || strafe !== 0) this.camYawFoot += diff * Math.min(1, 2.2 * dt);
      g.interiors.update(dt);
    }

    if (this.playerMode !== 'drive') {
      const item = g.interaction.update(g.player.pos);
      const label = item ? item.label() : null;
      ui.prompt = label ? '[E] ' + label : null;
      if (s.interactPressed && item && label) {
        g.audio.play('ui');
        item.action();
      }
    } else {
      ui.prompt = null;
    }

    if (this.playerMode === 'drive') {
      g.cameraRig.update(
        dt,
        veh.position,
        veh.heading,
        Math.min(1, Math.abs(veh.speed) / CONFIG.vehicle.maxSpeed)
      );
    } else {
      g.cameraRig.update(dt, g.player.pos, this.camYawFoot);
    }

    g.fsm.update(dt);
    this._scheduleOffers(dt, s);
    this._updateBeacon(dt);
    this._updateHud(dt, s);
  }

  _scheduleOffers(dt, s) {
    const fsm = this.g.fsm;
    if (s.shiftHeld) {
      this._shiftHoldTimer += dt;
      if (this._shiftHoldTimer >= 1.5) {
        this._shiftActive = !this._shiftActive;
        this._shiftHoldTimer = 0;
        if (this._shiftActive) {
          showShiftFlash('SHIFT STARTED');
        } else {
          toast('Shift ended.', 'info');
        }
        if (!this._shiftActive && fsm.state === DeliveryState.OFFER) {
          fsm.decline();
          this._offerExpiry = -1;
        }
      }
    } else {
      this._shiftHoldTimer = 0;
    }
    if (fsm.state === DeliveryState.COMPLETE) {
      this.completeTimer -= dt;
      if (this.completeTimer <= 0) {
        fsm.state = DeliveryState.IDLE;
        this.offerTimer = this._nextOfferWait();
      }
      return;
    }
    if (fsm.state === DeliveryState.OFFER) {
      this._offerExpiry -= dt;
      if (this._offerExpiry <= 0) {
        fsm.decline();
        toast('Order expired.', 'warn');
        this._offerExpiry = -1;
        this.offerTimer = this._nextOfferWait();
      }
      return;
    }
    if (fsm.state === DeliveryState.IDLE && !fsm.delivery && this._shiftActive) {
      this.offerTimer -= dt;
      if (this.offerTimer <= 0) {
        const d = this.g.generator.create(this.lastPickupId);
        if (d && fsm.offer(d)) {
          this.lastPickupId = d.pickup.id;
          this._offerExpiry = 5 + Math.random() * 5;
        } else {
          this.offerTimer = this._nextOfferWait();
        }
      }
    }
  }

  _updateBeacon(dt) {
    void dt;
    const fsm = this.g.fsm;
    const d = fsm.delivery;
    let pos = null;
    let hex = '#ffd23f';

    if (this.playerMode !== 'inside') {
      if (this._showCarBeacon && !fsm.isActive) {
        pos = this.g.vehicle.position;
        hex = '#4cc9f0';
      } else if (fsm.state === DeliveryState.RETURNING && d) {
        pos = this.g.vehicle.position;
        hex = '#4cc9f0';
      } else if (fsm.isActive && d) {
        pos = fsm.hasFood ? d.dropoff.pos : d.pickup.pos;
        hex = fsm.hasFood ? '#ff8c42' : '#ffd23f';
      } else if (fsm.state === DeliveryState.OFFER && d) {
        pos = d.pickup.pos;
        hex = '#9ef01a';
      }
    }

    this.targetPos = pos;
    this.beaconGroup.visible = !!pos && this.playerMode !== 'inside';
    if (pos) {
      this.beaconGroup.position.set(pos.x, 0, pos.z);
      this.beamMat.color.set(hex);
      this.ringMat.color.set(hex);
      const pulse = 1 + Math.sin(this._time * 4.2) * 0.14;
      this.ring.scale.setScalar(pulse);
      this.beamMat.opacity = 0.16 + Math.sin(this._time * 4.2) * 0.05;
    }
  }

  _updateHud(dt, s) {
    void dt;
    const g = this.g;
    const fsm = g.fsm;
    const d = fsm.delivery;

    ui.speedMph =
      this.playerMode === 'drive' ? Math.round(Math.abs(g.vehicle.speed) * 2.23694) : 0;
    ui.hasFood = fsm.hasFood;
    ui.day = g.dayCycle.day;
    ui.fuelLevel = g.vehicle.fuelLevel;
    ui.fuelMax = g.vehicle.fuelMax;
    ui.offerExpiry = fsm.state === DeliveryState.OFFER ? Math.ceil(this._offerExpiry) : -1;

    if (this.playerMode === 'drive') {
      const frac = g.vehicle.fuelFraction;
      if (frac <= 0 && !this._fuelWarned) {
        toast('Out of gas! Find a gas station.', 'danger', 5000);
        this._fuelWarned = true;
      } else if (frac > 0 && frac <= 0.25 && !this._fuelWarned) {
        toast('Low fuel! Find a gas station.', 'info', 4000);
        this._fuelWarned = true;
      } else if (frac > 0.25) {
        this._fuelWarned = false;
      }
    }

    const env = g.envState;
    ui.clock = env.clock;
    ui.phase = env.name;

    let obj = null;
    const st = fsm.state;
    if (d) {
      const ref = this.playerMode === 'drive' ? g.vehicle.position : g.player.pos;
      if (st === DeliveryState.OFFER) {
        obj = { title: `NEW ORDER  ${Math.ceil(this._offerExpiry)}s`, sub: `${d.pickup.name} → ${d.dropoff.name}`, distM: null };
      } else if (st === DeliveryState.TO_PICKUP || st === DeliveryState.PARKED_PICKUP) {
        obj = { title: 'PICK UP ORDER', sub: d.pickup.name, distM: ref.distanceTo(d.pickup.pos) };
      } else if (st === DeliveryState.ON_FOOT_PICKUP) {
        obj = { title: 'HEAD INSIDE', sub: d.pickup.name, distM: ref.distanceTo(d.pickup.pos) };
      } else if (st === DeliveryState.COLLECTING) {
        obj = { title: 'GRAB THE ORDER', sub: d.pickup.name, distM: 0 };
      } else if (st === DeliveryState.RETURNING) {
        obj = { title: 'BACK TO YOUR CAR', sub: '', distM: ref.distanceTo(g.vehicle.position) };
      } else if (st === DeliveryState.TO_CUSTOMER || st === DeliveryState.PARKED_CUSTOMER) {
        obj = { title: 'DELIVER TO', sub: d.dropoff.name, distM: ref.distanceTo(d.dropoff.pos) };
      } else if (st === DeliveryState.ON_FOOT_CUSTOMER) {
        obj = { title: 'HAND IT OVER', sub: d.dropoff.name, distM: ref.distanceTo(d.dropoff.pos) };
      }
    } else if (st === DeliveryState.IDLE || st === DeliveryState.COMPLETE) {
      if (this._shiftActive) {
        obj = { title: 'CRUISE AROUND', sub: 'New order incoming...', distM: null };
      } else {
        obj = { title: 'HOLD B TO BEGIN SHIFT', sub: '', distM: null };
      }
    }

    if (obj) {
      obj.distM = obj.distM != null ? Math.max(0, obj.distM) : null;
    }
    ui.objective = obj;

    if (fsm.isActive && d) {
      ui.timeLeftStr = fmtTime(fsm.timeLeft);
      ui.timeFrac = fsm.timeRemainingFrac;
      ui.timeCritical = fsm.timeLeft < 45;
    } else {
      ui.timeLeftStr = '';
      ui.timeFrac = 1;
      ui.timeCritical = false;
    }

    this._minimapClock -= dt;
    if (this._minimapClock <= 0) {
      this._minimapClock = 0.08;
      ui.blipsPlayer = {
        x: this.playerMode === 'drive' ? g.vehicle.position.x : g.player.pos.x,
        z: this.playerMode === 'drive' ? g.vehicle.position.z : g.player.pos.z,
        yaw: this.playerMode === 'drive' ? g.vehicle.heading : g.player.yaw
      };
      ui.blipsCar = this.playerMode === 'drive' ? null : { x: g.vehicle.position.x, z: g.vehicle.position.z };
      ui.blipsTarget = this.targetPos ? { x: this.targetPos.x, z: this.targetPos.z, food: fsm.hasFood } : null;
    }
  }

  exit() {
    for (const off of this._unsubs) off();
    this._unsubs = [];
    this._clearTempItems();
    this.beaconGroup.visible = false;
    this.g.audio.horn(false);
    this.g.audio.setEngine(0, 0, false);
    this.g.audio.setSkid(0);
  }

  _nextOfferWait() {
    const r = Math.random();
    return r < 0.15 ? 5 : r < 0.65 ? 10 : 20;
  }
}
