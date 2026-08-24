import * as THREE from 'three';
import { RNG } from '../core/RNG.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color('#8ecae6');
    scene.fog = new THREE.Fog('#cfe8f5', 130, 560);

    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    const rng = new RNG(1337);
    for (let i = 0; i < starCount; i++) {
      const theta = rng.float(0, Math.PI * 2);
      const phi = rng.float(0.05, Math.PI / 2.1);
      const r = 760;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(34, 20),
      new THREE.MeshBasicMaterial({ color: '#fff3b0', fog: false })
    );
    this.sunDisc.frustumCulled = false;
    scene.add(this.sunDisc);

    this.moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(22, 20),
      new THREE.MeshBasicMaterial({ color: '#e8edf8', fog: false, transparent: true, opacity: 0 })
    );
    this.moonDisc.frustumCulled = false;
    scene.add(this.moonDisc);

    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
    const cloudRng = new RNG(4242);
    for (let i = 0; i < 11; i++) {
      const g = new THREE.Group();
      const puffs = cloudRng.int(3, 5);
      for (let p = 0; p < puffs; p++) {
        const w = cloudRng.float(14, 30);
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, cloudRng.float(3.5, 6), cloudRng.float(9, 16)), cloudMat);
        box.position.set(cloudRng.float(-16, 16), cloudRng.float(-1.5, 2), cloudRng.float(-7, 7));
        g.add(box);
      }
      g.position.set(cloudRng.float(-480, 480), cloudRng.float(70, 120), cloudRng.float(-480, 480));
      g.userData.speed = cloudRng.float(1.2, 3.2);
      this.clouds.push(g);
      scene.add(g);
    }
  }

  apply(state, cameraPos) {
    this.scene.background.copy(state.sky);
    this.scene.fog.color.copy(state.fog);
    this.starMat.opacity = state.starAlpha;

    const sd = state.sunDir;
    this.sunDisc.position.copy(cameraPos).addScaledVector(sd, 700);
    this.sunDisc.lookAt(cameraPos);
    this.sunDisc.visible = sd.y > -0.12;
    this.moonDisc.position.copy(cameraPos).addScaledVector(sd, -680);
    this.moonDisc.lookAt(cameraPos);
    this.moonDisc.material.opacity = state.starAlpha;
    this.sunDisc.material.color.copy(state.sun);
  }

  update(dt) {
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 520) c.position.x = -520;
    }
  }
}
