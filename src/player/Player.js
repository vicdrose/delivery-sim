import * as THREE from 'three';
import { CONFIG } from '../config.js';

const P = CONFIG.player;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.walkPhase = 0;
    this.visible = false;

    const skinMat = new THREE.MeshLambertMaterial({ color: '#e8b98a' });
    const shirtMat = new THREE.MeshLambertMaterial({ color: '#2a9d8f' });
    const pantsMat = new THREE.MeshLambertMaterial({ color: '#35405c' });
    const capMat = new THREE.MeshLambertMaterial({ color: '#e8615a' });
    const bagMat = new THREE.MeshLambertMaterial({ color: '#d94f3d' });

    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.18), pantsMat);
    this.legR = this.legL.clone();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.26), shirtMat);
    torso.position.y = 0.52 + 0.28;
    const armGeo = new THREE.BoxGeometry(0.11, 0.46, 0.13);
    this.armL = new THREE.Mesh(armGeo, shirtMat);
    this.armR = this.armL.clone();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skinMat);
    head.position.y = 1.32;
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    capTop.position.y = 1.36;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), capMat);
    brim.position.set(0, 1.38, 0.24);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.2), bagMat);
    bag.position.set(0, 0.78, -0.24);
    bag.castShadow = true;

    for (const m of [torso, head]) m.castShadow = true;

    this.bodyNode = new THREE.Group();
    this.legL.position.set(-0.12, 0.26, 0);
    this.legR.position.set(0.12, 0.26, 0);
    this.armL.position.set(-0.29, 0.75, 0);
    this.armR.position.set(0.29, 0.75, 0);
    this.bodyNode.add(this.legL, this.legR, torso, this.armL, this.armR, head, capTop, brim, bag);
    this.group.add(this.bodyNode);

    this.heldBag = this._buildHeldBag();
    this.heldBag.visible = false;
    this._holdingBag = false;
    this.bodyNode.add(this.heldBag);
    this.group.visible = false;
    scene.add(this.group);
  }

  teleport(x, z, yaw = this.yaw) {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.syncMesh();
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  update(dt, moveX, moveZ, sprint, camYaw, collision) {
    let mx = moveX;
    let mz = moveZ;
    if (mx !== 0 || mz !== 0) {
      const s = Math.sin(camYaw);
      const c = Math.cos(camYaw);
      const wx = mz * s - mx * c;
      const wz = mz * c + mx * s;
      const len = Math.hypot(wx, wz);
      if (len > 1) { mx = wx / len; mz = wz / len; } else { mx = wx; mz = wz; }
      const speed = sprint ? P.sprintSpeed : P.walkSpeed;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      collision.resolveCircle(this.pos, P.radius, 'city');
      const targetYaw = Math.atan2(mx, mz);
      let d = targetYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, P.turnLerp * dt);
      this.walkPhase += speed * dt * 2.6;
    } else {
      this.walkPhase *= Math.exp(-8 * dt);
    }
    this.syncMesh();
    return mx !== 0 || mz !== 0;
  }

  syncMesh() {
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.y = this.yaw;
    const swing = Math.sin(this.walkPhase) * 0.65;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    if (this._holdingBag) {
      this.armL.rotation.x = -0.55;
      this.armR.rotation.x = -0.55;
    } else {
      this.armL.rotation.x = -swing * 0.7;
      this.armR.rotation.x = swing * 0.7;
    }
    this.bodyNode.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.04;
  }

  setHoldingBag(v) {
    this._holdingBag = v;
    this.heldBag.visible = v;
  }

  _buildHeldBag() {
    const g = new THREE.Group();
    const bagMat = new THREE.MeshLambertMaterial({ color: '#c9915a' });
    const receiptMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.18), bagMat);
    body.position.y = 0.15;
    body.castShadow = true;
    g.add(body);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.05), bagMat);
    flap.position.set(0, 0.32, -0.07);
    g.add(flap);
    const receipt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.01), receiptMat);
    receipt.position.set(0, 0.2, 0.095);
    g.add(receipt);
    g.position.set(0, 0.52, 0.28);
    return g;
  }
}
