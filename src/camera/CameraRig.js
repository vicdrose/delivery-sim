import * as THREE from 'three';
import { CONFIG } from '../config.js';

const C = CONFIG.camera;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'car';
    this._pos = new THREE.Vector3(0, 6, -10);
    this._look = new THREE.Vector3();
    this.trauma = 0;
    this.orbitYaw = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.baseFov = CONFIG.render.fov;
    this._shakeVec = new THREE.Vector3();
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  setMode(mode) {
    this.mode = mode;
    this.orbitYaw = 0;
    this.resetLook();
  }

  resetLook() {
    this.lookYaw = 0;
    this.lookPitch = 0;
  }

  updateLook(dt, x, y, snapBack) {
    const ix = Number.isFinite(x) ? x : 0;
    const iy = Number.isFinite(y) ? y : 0;
    if (Math.hypot(ix, iy) > 0.01) {
      this.lookYaw = Math.min(
        C.stickLookYawLimit,
        Math.max(-C.stickLookYawLimit, this.lookYaw + ix * C.stickLookYawSpeed * dt)
      );
      this.lookPitch = Math.min(
        C.stickLookPitchLimit,
        Math.max(-C.stickLookPitchLimit, this.lookPitch - iy * C.stickLookPitchSpeed * dt)
      );
      return;
    }
    if (!snapBack) return;
    const k = 1 - Math.exp(-C.stickLookReturn * dt);
    this.lookYaw *= 1 - k;
    this.lookPitch *= 1 - k;
    if (Math.abs(this.lookYaw) < 0.0005) this.lookYaw = 0;
    if (Math.abs(this.lookPitch) < 0.0005) this.lookPitch = 0;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, focus, heading, speed01 = 0) {
    let desired;
    let look;
    let kPos = 1 - Math.exp(-C.smoothPos * dt);
    let kLook = 1 - Math.exp(-C.smoothLook * dt);
    if (this.mode === 'car') {
      const yaw = heading + this.orbitYaw + this.lookYaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      desired = this._tmpA.set(
        focus.x - fx * C.carDist,
        C.carHeight,
        focus.z - fz * C.carDist
      );
      look = this._tmpB.set(focus.x + fx * C.carLookAhead, 1.4, focus.z + fz * C.carLookAhead);
    } else if (this.mode === 'foot') {
      const yaw = heading + this.orbitYaw + this.lookYaw;
      const dist = C.footDist;
      desired = this._tmpA.set(
        focus.x - Math.sin(yaw) * dist,
        C.footHeight,
        focus.z - Math.cos(yaw) * dist
      );
      look = this._tmpB.set(focus.x + Math.sin(yaw) * 2.2, 1.5, focus.z + Math.cos(yaw) * 2.2);
    } else if (this.mode === 'bike') {
      const yaw = heading + this.orbitYaw + this.lookYaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      desired = this._tmpA.set(
        focus.x - fx * C.bikeDist,
        C.bikeHeight,
        focus.z - fz * C.bikeDist
      );
      look = this._tmpB.set(
        focus.x + fx * C.bikeLookAhead,
        C.bikeLookHeight,
        focus.z + fz * C.bikeLookAhead
      );
      kPos = 1 - Math.exp(-C.bikeSmoothPos * dt);
      kLook = 1 - Math.exp(-C.bikeSmoothLook * dt);
    } else {
      const yaw = heading + this.orbitYaw + this.lookYaw;
      const dist = 4.4;
      desired = this._tmpA.set(
        focus.x - Math.sin(yaw) * dist,
        4.6,
        focus.z - Math.cos(yaw) * dist
      );
      look = this._tmpB.set(focus.x, 1.0, focus.z);
    }

    const pitchLook =
      this.mode === 'car'
        ? C.carLookAhead
        : this.mode === 'bike'
          ? C.bikeLookAhead
          : this.mode === 'foot'
            ? 2.2
            : 4.4;
    look.y += Math.sin(this.lookPitch) * pitchLook;

    this._pos.lerp(desired, kPos);
    this._look.lerp(look, kLook);

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const sh = this.trauma * this.trauma;
    this._shakeVec.set(
      (Math.random() - 0.5) * sh * 0.7,
      (Math.random() - 0.5) * sh * 0.5,
      (Math.random() - 0.5) * sh * 0.7
    );

    this.camera.position.copy(this._pos).add(this._shakeVec);
    this.camera.lookAt(this._look);

    const boost =
      this.mode === 'car' ? C.speedFovBoost : this.mode === 'bike' ? C.speedFovBoost * 0.7 : 0;
    const targetFov = this.baseFov + speed01 * boost;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 4 * dt);
      this.camera.updateProjectionMatrix();
    }
  }

  snapBehind(focus, heading) {
    this.resetLook();
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const bike = this.mode === 'bike';
    const dist = bike ? C.bikeDist : this.mode === 'car' ? C.carDist : C.footDist;
    const h = bike ? C.bikeHeight : this.mode === 'car' ? C.carHeight : C.footHeight;
    this._pos.set(focus.x - fx * dist, h, focus.z - fz * dist);
    this._look.set(
      focus.x + fx * (bike ? C.bikeLookAhead : 2),
      bike ? C.bikeLookHeight : 1.4,
      focus.z + fz * (bike ? C.bikeLookAhead : 2)
    );
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
