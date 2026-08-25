import * as THREE from 'three';
import { CONFIG } from '../config.js';

const V = CONFIG.vehicle;

export class Vehicle {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.heading = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.steerSmooth = 0;
    this.parkedDwell = 0;
    this.velocity = new THREE.Vector3();
    this.onCrash = null;
    this.onSkid = null;
    this._skidLevel = 0;

    this.group = new THREE.Group();
    this.tiltNode = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: '#e8615a' });
    const cabinMat = new THREE.MeshLambertMaterial({ color: '#3b4652' });
    const darkMat = new THREE.MeshLambertMaterial({ color: '#22262c' });
    const tireMat = new THREE.MeshLambertMaterial({ color: '#1a1d21' });
    const rimMat = new THREE.MeshLambertMaterial({ color: '#d8d8d8' });

    const body = new THREE.Mesh(new THREE.BoxGeometry(V.bodyWidth, 0.72, V.bodyLength), bodyMat);
    body.position.y = 0.72;
    body.castShadow = true;
    this.tiltNode.add(body);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(V.bodyWidth * 0.96, 0.3, V.bodyLength * 0.28), bodyMat);
    hood.position.set(0, 1.14, V.bodyLength * 0.34);
    hood.castShadow = true;
    this.tiltNode.add(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(V.bodyWidth * 0.86, 0.62, V.bodyLength * 0.42), cabinMat);
    cabin.position.set(0, 1.36, -V.bodyLength * 0.06);
    cabin.castShadow = true;
    this.tiltNode.add(cabin);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(V.bodyWidth * 1.02, 0.22, 0.24), darkMat);
    bumperF.position.set(0, 0.52, V.bodyLength / 2);
    this.tiltNode.add(bumperF);
    const bumperR = bumperF.clone();
    bumperR.position.z = -V.bodyLength / 2;
    this.tiltNode.add(bumperR);

    this.headlightMats = [];
    for (const sx of [-1, 1]) {
      const hlMat = new THREE.MeshLambertMaterial({ color: '#fff8dc', emissive: '#fff2c2', emissiveIntensity: 0 });
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), hlMat);
      hl.position.set(sx * V.bodyWidth * 0.32, 0.86, V.bodyLength / 2 + 0.02);
      this.tiltNode.add(hl);
      this.headlightMats.push(hlMat);
    }
    this.taillightMats = [];
    for (const sx of [-1, 1]) {
      const tlMat = new THREE.MeshLambertMaterial({ color: '#7a1f1f', emissive: '#ff3326', emissiveIntensity: 0.15 });
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tlMat);
      tl.position.set(sx * V.bodyWidth * 0.32, 0.86, -V.bodyLength / 2 - 0.02);
      this.tiltNode.add(tl);
      this.taillightMats.push(tlMat);
    }

    const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), darkMat);
    signPost.position.set(0, 1.85, -V.bodyLength * 0.06);
    this.tiltNode.add(signPost);
    const signBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 3), new THREE.MeshLambertMaterial({ color: '#f2a541' }));
    signBase.rotation.y = Math.PI / 6;
    signBase.position.set(0, 2.05, -V.bodyLength * 0.06);
    signBase.castShadow = true;
    this.tiltNode.add(signBase);
    const signTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 3), new THREE.MeshLambertMaterial({ color: '#e8615a' }));
    signTop.rotation.y = Math.PI / 6;
    signTop.position.set(0, 2.17, -V.bodyLength * 0.06);
    this.tiltNode.add(signTop);

    this.wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    this.wheelGeo.rotateZ(Math.PI / 2);
    this.wheels = [];
    this.frontWheelPivots = [];
    const wx = V.bodyWidth / 2 - 0.05;
    const wz = V.bodyLength * 0.31;
    for (const [sx, sz, front] of [[-wx, wz, true], [wx, wz, true], [-wx, -wz, false], [wx, -wz, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx, 0.38, sz);
      const tire = new THREE.Mesh(this.wheelGeo, tireMat);
      tire.castShadow = true;
      pivot.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 8).rotateZ(Math.PI / 2), rimMat);
      pivot.add(rim);
      this.tiltNode.add(pivot);
      this.wheels.push({ pivot, tire, front });
      if (front) this.frontWheelPivots.push(pivot);
    }

    this.group.add(this.tiltNode);
    scene.add(this.group);
  }

  reset(x, z, heading) {
    this.heading = heading;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.steerSmooth = 0;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    this.syncMesh(0);
  }

  get position() {
    return this.group.position;
  }

  get speed() {
    return this.forwardSpeed;
  }

  forwardVector(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  exitPosition(out = new THREE.Vector3()) {
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    return out.set(
      this.group.position.x - rx * (V.bodyWidth / 2 + 0.9),
      0,
      this.group.position.z - rz * (V.bodyWidth / 2 + 0.9)
    );
  }

  update(dt, controls) {
    const targetSteer = THREE.MathUtils.clamp(controls.steer, -1, 1);
    const steerLerp = 1 - Math.exp(-10 * dt);
    this.steerSmooth += (targetSteer - this.steerSmooth) * steerLerp;

    let fs = this.forwardSpeed;
    const throttle = controls.throttle || 0;
    const brake = controls.brake || 0;

    if (throttle > 0) {
      const headroom = Math.max(0, 1 - Math.max(0, fs) / V.maxSpeed);
      fs += V.accel * throttle * headroom * dt;
    }
    if (brake > 0) {
      if (fs > 0.4) {
        fs -= V.brakeForce * brake * dt;
        if (fs < 0) fs = 0;
      } else {
        fs -= V.accel * 0.55 * brake * dt;
        if (fs < -V.maxReverse) fs = -V.maxReverse;
      }
    }
    if (throttle === 0 && brake === 0) {
      const decel = V.engineBrake * dt;
      if (Math.abs(fs) <= decel) fs = 0;
      else fs -= Math.sign(fs) * decel;
    }
    fs -= fs * Math.abs(fs) * V.dragCoef * dt;

    if (controls.handbrake) {
      const decel = V.handbrakeDecel * dt;
      if (Math.abs(fs) <= decel) fs = 0;
      else fs -= Math.sign(fs) * decel;
    }

    const absFs = Math.abs(fs);
    const steerFade = THREE.MathUtils.clamp(absFs / V.steerFadeSpeed, 0, 1);
    const steerRate = THREE.MathUtils.lerp(V.steerRateLow, V.steerRateHigh, steerFade);
    const turnAuth = THREE.MathUtils.clamp(absFs / 2.2, 0, 1);
    this.heading -= this.steerSmooth * steerRate * turnAuth * dt * Math.sign(fs || 1) * (controls.handbrake ? 1.35 : 1);

    const grip = controls.handbrake ? V.gripHandbrake : V.gripLateral;
    this.lateralSpeed *= Math.exp(-grip * dt);

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = fz;
    const rz = -fx;
    let vx = fx * fs + rx * this.lateralSpeed;
    let vz = fz * fs + rz * this.lateralSpeed;

    const pos = this.group.position;
    pos.x += vx * dt;
    pos.z += vz * dt;

    const preVx = vx;
    const preVz = vz;
    let hitNormal = null;
    const probeF = { x: pos.x + fx * V.bodyLength * 0.26, z: pos.z + fz * V.bodyLength * 0.26 };
    const probeR = { x: pos.x - fx * V.bodyLength * 0.26, z: pos.z - fz * V.bodyLength * 0.26 };
    const tmp = { x: 0, z: 0 };
    const velObj = { x: vx, z: vz };
    for (const p of [probeF, probeR]) {
      tmp.x = p.x;
      tmp.z = p.z;
      const n = this.collision.resolveCircle(tmp, V.collisionRadius, 'city', velObj);
      if (n) {
        pos.x += tmp.x - p.x;
        pos.z += tmp.z - p.z;
        hitNormal = n;
      }
    }
    vx = velObj.x;
    vz = velObj.z;

    if (hitNormal) {
      const impact = Math.hypot(preVx - vx, preVz - vz);
      if (impact > 3 && this.onCrash) this.onCrash(Math.min(1, impact / 20));
    }
    this.velocity.set(vx, 0, vz);

    const newFs = vx * fx + vz * fz;
    const newLat = vx * rx + vz * rz;
    this.forwardSpeed = newFs;
    this.lateralSpeed = newLat;

    const skidTarget = (controls.handbrake && absFs > 5) || Math.abs(newLat) > 3.2 ? Math.min(1, Math.abs(newLat) / 6 + 0.4) : 0;
    this._skidLevel += (skidTarget - this._skidLevel) * (1 - Math.exp(-8 * dt));
    if (this._skidLevel > 0.15 && this.onSkid) this.onSkid(this._skidLevel);

    this.parkedDwell = absFs < V.parkedSpeedThreshold ? this.parkedDwell + dt : 0;

    this.syncMesh(dt);
  }

  syncMesh(dt) {
    void dt;
    this.group.rotation.y = this.heading;
    const roll = -this.steerSmooth * Math.min(1, Math.abs(this.forwardSpeed) / 12) * 0.06;
    const pitch = THREE.MathUtils.clamp(-this.forwardSpeed * 0.0016, -0.03, 0.04);
    this.tiltNode.rotation.z += (roll - this.tiltNode.rotation.z) * 0.15;
    this.tiltNode.rotation.x += (pitch - this.tiltNode.rotation.x) * 0.12;
    const wheelSpin = (this.forwardSpeed / 0.38) * 0.016;
    for (const w of this.wheels) w.pivot.rotation.x += wheelSpin;
    for (const p of this.frontWheelPivots) p.rotation.y = this.steerSmooth * 0.42;
  }

  setNightFactor(f) {
    for (const m of this.headlightMats) m.emissiveIntensity = f * 1.4;
    this.headlightOn = f > 0.45;
  }

  setBrakeLights(on) {
    for (const m of this.taillightMats) m.emissiveIntensity = on ? 1.2 : 0.15;
  }

  get isParkedStill() {
    return this.parkedDwell >= CONFIG.vehicle.parkedDwellTime;
  }
}
