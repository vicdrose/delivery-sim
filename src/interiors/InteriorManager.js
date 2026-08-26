import * as THREE from 'three';

const ORIGIN = new THREE.Vector3(5000, 0, 5000);

export class InteriorManager {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.insidePoi = null;
    this.returnPos = new THREE.Vector3();
    this._built = false;
  }

  build() {
    if (this._built) return;
    this._built = true;
    const g = new THREE.Group();

    const floorMat = new THREE.MeshLambertMaterial({ color: '#cfc8ba' });
    const wallMat = new THREE.MeshLambertMaterial({ color: '#e7e0d2' });
    const counterMat = new THREE.MeshLambertMaterial({ color: '#8a6248' });
    this.accentMat = new THREE.MeshLambertMaterial({ color: '#e8615a' });
    const darkMat = new THREE.MeshLambertMaterial({ color: '#3b4048' });

    const ox = ORIGIN.x;
    const oz = ORIGIN.z;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.2, 10), floorMat);
    floor.position.set(ox, -0.1, oz);
    floor.receiveShadow = true;
    g.add(floor);

    const wallH = 3.4;
    const mkWall = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
    };
    mkWall(13, wallH, 0.3, ox, wallH / 2, oz - 5);
    mkWall(0.3, wallH, 10, ox - 6.5, wallH / 2, oz);
    mkWall(0.3, wallH, 10, ox + 6.5, wallH / 2, oz);
    mkWall(4.6, wallH, 0.3, ox - 4.2, wallH / 2, oz + 5);
    mkWall(4.6, wallH, 0.3, ox + 4.2, wallH / 2, oz + 5);
    mkWall(3.8, 0.9, 0.3, ox, wallH - 0.45, oz + 5);

    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.05, 1.2), counterMat);
    counter.position.set(ox + 2.6, 0.52, oz - 1.4);
    counter.castShadow = true;
    g.add(counter);

    const register = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.45), darkMat);
    register.position.set(ox + 1.6, 1.28, oz - 1.4);
    g.add(register);

    const counterFront = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 0.08), this.accentMat);
    counterFront.position.set(ox + 2.6, 0.42, oz - 0.76);
    g.add(counterFront);

    this.menuBoard = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.7, 0.12), this.accentMat);
    this.menuBoard.position.set(ox + 2.6, 2.2, oz - 4.75);
    g.add(this.menuBoard);

    const awningStrip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.35), this.accentMat);
    awningStrip.position.set(ox, 2.95, oz + 5);
    g.add(awningStrip);

    for (const [tx, tz] of [[-3.5, 1.5], [-3.5, 3.2], [-1.5, 2.4]]) {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 10), counterMat);
      table.position.set(ox + tx, 0.85, oz + tz);
      g.add(table);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 6), darkMat);
      leg.position.set(ox + tx, 0.42, oz + tz);
      g.add(leg);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 8), darkMat);
      stool.position.set(ox + tx, 0.25, oz + tz + 0.9);
      g.add(stool);
    }

    this.pickupMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshBasicMaterial({ color: '#ffd23f' })
    );
    this.pickupMarker.position.set(ox + 2.6, 1.75, oz - 0.4);
    g.add(this.pickupMarker);

    this.counterBag = this._buildBag();
    this.counterBag.position.set(ox + 3.2, 1.1, oz - 1.4);
    this.counterBag.visible = false;
    g.add(this.counterBag);

    this.light = new THREE.PointLight('#ffe6bd', 60, 26, 2);
    this.light.position.set(ox, 3.0, oz);
    this.light.visible = false;
    g.add(this.light);

    this.group = g;
    this.group.visible = false;
    this.scene.add(g);

    const c = this.collision;
    c.addBox(ox, oz - 5, 7, 1, 'interior');
    c.addBox(ox - 7, oz, 1, 6, 'interior');
    c.addBox(ox + 7, oz, 1, 6, 'interior');
    c.addBox(ox, oz + 6, 7, 1, 'interior');
    c.addBox(ox + 2.6, oz - 1.4, 2.6, 0.6, 'interior');

    this.entryPos = new THREE.Vector3(ox, 0, oz + 3.9);
    this.exitAnchor = new THREE.Vector3(ox, 0, oz + 4.4);
  }

  get isInside() {
    return this.insidePoi !== null;
  }

  enter(poi, playerPosToRestore) {
    this.build();
    this.returnPos.copy(playerPosToRestore);
    this.insidePoi = poi;
    this.group.visible = true;
    this.light.visible = true;
    const accents = ['#e8615a', '#2a9d8f', '#f2a541', '#457b9d', '#b56576'];
    const hash = [...poi.name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    this.accentMat.color.set(accents[hash % accents.length]);
    return { entryPos: this.entryPos.clone(), exitAnchor: this.exitAnchor.clone() };
  }

  exit() {
    const poi = this.insidePoi;
    this.insidePoi = null;
    this.group.visible = false;
    this.light.visible = false;
    return { poi, returnPos: this.returnPos.clone() };
  }

  update(dt) {
    if (!this._built || !this.group.visible) return;
    this.pickupMarker.rotation.y += dt * 2.2;
    this.pickupMarker.position.y = 1.75 + Math.sin(performance.now() * 0.003) * 0.09;
  }

  _buildBag() {
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

  showCounterBag() {
    if (!this._built) return;
    this.counterBag.visible = true;
    this.pickupMarker.visible = false;
  }

  hideCounterBag() {
    if (!this._built) return;
    this.counterBag.visible = false;
  }
}
