import * as THREE from 'three';

export class BikeViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.visible = false;
    this._time = 0;
    camera.add(this.group);

    const metal = new THREE.MeshLambertMaterial({
      color: '#c8ccd0',
      depthTest: false,
      depthWrite: false,
      emissive: '#3a4046',
      emissiveIntensity: 0.35
    });
    const rubber = new THREE.MeshLambertMaterial({
      color: '#1b1e22',
      depthTest: false,
      depthWrite: false
    });
    const wicker = new THREE.MeshLambertMaterial({
      color: '#b9844e',
      depthTest: false,
      depthWrite: false,
      emissive: '#4a3018',
      emissiveIntensity: 0.3
    });

    const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      mesh.rotation.z = rz;
      mesh.renderOrder = 1000;
      this.group.add(mesh);
      return mesh;
    };

    add(new THREE.BoxGeometry(0.84, 0.06, 0.07), metal, 0, -0.42, -0.95);
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.2, 0.1, 0.1), rubber, sx * 0.35, -0.41, -0.95, 0, sx * 0.08);
      add(new THREE.BoxGeometry(0.03, 0.02, 0.16), metal, sx * 0.27, -0.37, -0.99);
    }
    add(new THREE.BoxGeometry(0.09, 0.24, 0.09), metal, 0, -0.55, -0.99, 0.22);

    add(new THREE.BoxGeometry(0.52, 0.035, 0.06), wicker, 0, -0.58, -1.18);
    add(new THREE.BoxGeometry(0.13, 0.44, 0.08), rubber, 0, -0.66, -1.34, -0.16);
    add(new THREE.BoxGeometry(0.035, 0.38, 0.09), metal, 0, -0.65, -1.33, -0.16);
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  update(dt, steer, speed01) {
    if (!this.group.visible) return;
    this._time += dt * (2 + speed01 * 9);
    const bob = Math.sin(this._time) * 0.006 * speed01;
    this.group.position.y = bob;
    this.group.rotation.y = steer * 0.14;
    this.group.rotation.z = -steer * 0.045;
    const scale = THREE.MathUtils.clamp(this.camera.aspect / 1.35, 0.35, 1);
    this.group.scale.set(scale, 1, 1);
  }
}
