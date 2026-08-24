import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _color = new THREE.Color();

function paint(geom, hex) {
  _color.set(hex);
  const count = geom.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = _color.r;
    arr[i * 3 + 1] = _color.g;
    arr[i * 3 + 2] = _color.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

export class GeoBucket {
  constructor() {
    this.geoms = [];
  }

  add(geom, hex) {
    paint(geom, hex);
    this.geoms.push(geom);
  }

  box(w, h, d, x, y, z, hex, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.add(g, hex);
  }

  cyl(rt, rb, h, seg, x, y, z, hex) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    g.translate(x, y, z);
    this.add(g, hex);
  }

  cone(r, h, seg, x, y, z, hex, rotY = 0) {
    const g = new THREE.ConeGeometry(r, h, seg);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.add(g, hex);
  }

  groundQuad(w, d, x, y, z, hex) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    this.add(g, hex);
  }

  wallQuad(w, h, x, y, z, ry, hex) {
    const g = new THREE.PlaneGeometry(w, h);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.add(g, hex);
  }

  get isEmpty() {
    return this.geoms.length === 0;
  }

  build(material, { castShadow = true, receiveShadow = true } = {}) {
    if (this.isEmpty) return null;
    const merged = mergeGeometries(this.geoms, false);
    for (const g of this.geoms) g.dispose();
    this.geoms.length = 0;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }
}

export function frameAt(x, z, ry) {
  return {
    x,
    z,
    ry,
    c: Math.cos(ry),
    s: Math.sin(ry),
    to(dx, dz) {
      return {
        x: this.x + dx * this.c + dz * this.s,
        z: this.z - dx * this.s + dz * this.c
      };
    },
    worldRot(extraRy = 0) {
      return this.ry + extraRy;
    }
  };
}
