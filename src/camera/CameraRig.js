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
    this.baseFov = CONFIG.render.fov;
    this._shakeVec = new THREE.Vector3();
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  setMode(mode) {
    this.mode = mode;
    this.orbitYaw = 0;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, focus, heading, speed01 = 0) {
    let desired;
    let look;
    if (this.mode === 'car') {
      const yaw = heading + this.orbitYaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      desired = this._tmpA.set(
        focus.x - fx * C.carDist,
        C.carHeight,
        focus.z - fz * C.carDist
      );
      look = this._tmpB.set(focus.x + fx * C.carLookAhead, 1.4, focus.z + fz * C.carLookAhead);
    } else if (this.mode === 'foot') {
      const yaw = heading + this.orbitYaw;
      const dist = C.footDist;
      desired = this._tmpA.set(
        focus.x - Math.sin(yaw) * dist,
        C.footHeight,
        focus.z - Math.cos(yaw) * dist
      );
      look = this._tmpB.set(focus.x + Math.sin(yaw) * 2.2, 1.5, focus.z + Math.cos(yaw) * 2.2);
    } else {
      const yaw = heading + this.orbitYaw;
      const dist = 4.4;
      desired = this._tmpA.set(
        focus.x - Math.sin(yaw) * dist,
        4.6,
        focus.z - Math.cos(yaw) * dist
      );
      look = this._tmpB.set(focus.x, 1.0, focus.z);
    }

    const kPos = 1 - Math.exp(-C.smoothPos * dt);
    const kLook = 1 - Math.exp(-C.smoothLook * dt);
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

    const targetFov = this.baseFov + (this.mode === 'car' ? speed01 * C.speedFovBoost : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 4 * dt);
      this.camera.updateProjectionMatrix();
    }
  }

  snapBehind(focus, heading) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const dist = this.mode === 'car' ? C.carDist : C.footDist;
    const h = this.mode === 'car' ? C.carHeight : C.footHeight;
    this._pos.set(focus.x - fx * dist, h, focus.z - fz * dist);
    this._look.set(focus.x + fx * 2, 1.4, focus.z + fz * 2);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
