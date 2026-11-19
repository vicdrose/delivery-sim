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

    const makeBox = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

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

    const restaurant = new THREE.Group();
    g.add(restaurant);
    restaurant.add(makeBox(5.2, 1.05, 1.2, ox + 2.6, 0.52, oz - 1.4, counterMat));
    restaurant.add(makeBox(0.55, 0.4, 0.45, ox + 1.6, 1.28, oz - 1.4, darkMat));
    restaurant.add(makeBox(5.2, 0.5, 0.08, ox + 2.6, 0.42, oz - 0.76, this.accentMat));

    this.menuBoard = makeBox(4.4, 1.7, 0.12, ox + 2.6, 2.2, oz - 4.75, this.accentMat);
    restaurant.add(this.menuBoard);
    restaurant.add(makeBox(2.6, 0.35, 0.35, ox, 2.95, oz + 5, this.accentMat));

    for (const [tx, tz] of [[-3.5, 1.5], [-3.5, 3.2], [-1.5, 2.4]]) {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 10), counterMat);
      table.position.set(ox + tx, 0.85, oz + tz);
      restaurant.add(table);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 6), darkMat);
      leg.position.set(ox + tx, 0.42, oz + tz);
      restaurant.add(leg);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 8), darkMat);
      stool.position.set(ox + tx, 0.25, oz + tz + 0.9);
      restaurant.add(stool);
    }

    this.pickupMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshBasicMaterial({ color: '#ffd23f' })
    );
    this.pickupMarker.position.set(ox + 2.6, 1.75, oz - 0.4);
    restaurant.add(this.pickupMarker);

    this.counterBag = this._buildBag();
    this.counterBag.position.set(ox + 3.2, 1.1, oz - 1.4);
    this.counterBag.visible = false;
    restaurant.add(this.counterBag);
    this.restaurantGroup = restaurant;

    const gas = new THREE.Group();
    g.add(gas);
    const fridgeBodyMat = new THREE.MeshLambertMaterial({ color: '#dfe7e6' });
    const fridgeGlassMat = new THREE.MeshLambertMaterial({
      color: '#79c9c4',
      emissive: '#1d4c4a',
      emissiveIntensity: 0.35
    });
    const canMat = new THREE.MeshLambertMaterial({ color: '#2a9d8f' });
    const fridgeX = ox - 5.85;
    for (let i = 0; i < 5; i += 1) {
      const z = oz + 4.2 - i * 2.1;
      gas.add(makeBox(0.9, 2.4, 1.7, fridgeX, 1.2, z, fridgeBodyMat));
      gas.add(makeBox(0.07, 1.85, 1.45, fridgeX + 0.49, 1.1, z, fridgeGlassMat));
      gas.add(makeBox(0.1, 0.55, 0.07, fridgeX + 0.57, 1.15, z - 0.56, darkMat));
      gas.add(makeBox(0.05, 0.24, 1.2, fridgeX + 0.55, 2.05, z, this.accentMat));
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.28, 8), canMat);
      can.position.set(fridgeX + 0.59, 0.72, z + 0.3);
      gas.add(can);
    }

    const chipMats = ['#e76f51', '#f4a261', '#e9c46a', '#d62828'].map(
      (color) => new THREE.MeshLambertMaterial({ color })
    );
    const candyMats = ['#7b2cbf', '#3a86ff', '#ff006e', '#fb5607'].map(
      (color) => new THREE.MeshLambertMaterial({ color })
    );
    const addSnackDivider = (x, z, backKind) => {
      gas.add(makeBox(4.4, 1.45, 0.9, x, 0.72, z, counterMat));
      for (const shelfY of [0.58, 1.08]) {
        gas.add(makeBox(4.3, 0.06, 1.25, x, shelfY, z, darkMat));
        for (let i = 0; i < 5; i += 1) {
          const xi = x - 1.7 + i * 0.85;
          for (const side of [-1, 1]) {
            const kind = side < 0 ? backKind : backKind === 'chips' ? 'candy' : 'chips';
            const mats = kind === 'chips' ? chipMats : candyMats;
            const h = kind === 'chips' ? 0.3 : 0.2;
            const item = makeBox(
              0.34,
              h,
              0.14,
              xi,
              shelfY + 0.03 + h / 2,
              z + side * 0.55,
              mats[(i + (side > 0 ? 1 : 0)) % mats.length]
            );
            gas.add(item);
          }
        }
      }
      gas.add(makeBox(4.4, 0.22, 1.05, x, 1.58, z, this.accentMat));
    };
    addSnackDivider(ox, oz - 2.5, 'chips');
    addSnackDivider(ox, oz + 1.9, 'candy');

    const glassCaseMat = new THREE.MeshLambertMaterial({
      color: '#bfe9ff',
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });
    const bunMat = new THREE.MeshLambertMaterial({ color: '#e8b96b' });
    const sausageMat = new THREE.MeshLambertMaterial({ color: '#8c3b2e' });
    const cheeseMat = new THREE.MeshLambertMaterial({ color: '#f2b134' });
    const sauceMat = new THREE.MeshLambertMaterial({ color: '#d62828' });
    const heatMat = new THREE.MeshLambertMaterial({
      color: '#ff8a3d',
      emissive: '#b23a00',
      emissiveIntensity: 0.4
    });
    const addGlass = (w, h, d, x, y, z) => {
      const pane = makeBox(w, h, d, x, y, z, glassCaseMat);
      pane.castShadow = false;
      gas.add(pane);
    };
    const caseX = ox + 5.5;
    const caseZ = oz + 1.6;
    gas.add(makeBox(1.3, 0.9, 3.0, caseX, 0.45, caseZ, counterMat));
    gas.add(makeBox(1.15, 0.06, 2.85, caseX, 0.94, caseZ, darkMat));
    addGlass(0.06, 1.0, 2.85, caseX - 0.62, 1.45, caseZ);
    addGlass(0.06, 1.0, 3.0, caseX + 0.62, 1.45, caseZ);
    addGlass(1.3, 0.06, 3.0, caseX, 1.97, caseZ);
    for (let i = 0; i < 3; i += 1) {
      const hz = caseZ - 1.05 + i * 0.6;
      gas.add(makeBox(0.55, 0.1, 0.5, caseX - 0.18, 1.04, hz, bunMat));
      gas.add(makeBox(0.12, 0.1, 0.52, caseX - 0.18, 1.12, hz, sausageMat));
    }
    const pizzaZ = caseZ + 0.95;
    const pizza = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 12), cheeseMat);
    pizza.position.set(caseX + 0.18, 1.02, pizzaZ);
    gas.add(pizza);
    for (let i = 0; i < 4; i += 1) {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 8), sauceMat);
      dot.position.set(
        caseX + 0.18 + Math.cos(i * Math.PI / 2) * 0.17,
        1.06,
        pizzaZ + Math.sin(i * Math.PI / 2) * 0.17
      );
      gas.add(dot);
    }
    gas.add(makeBox(0.9, 0.08, 0.14, caseX, 1.86, caseZ - 0.95, heatMat));
    gas.add(makeBox(0.9, 0.08, 0.14, caseX, 1.86, caseZ + 0.95, heatMat));

    gas.add(makeBox(2.1, 0.95, 0.8, ox + 4.3, 0.48, oz + 3.4, counterMat));
    gas.add(makeBox(0.52, 0.38, 0.42, ox + 4.3, 1.15, oz + 3.4, darkMat));
    gas.add(makeBox(1.6, 0.16, 0.5, ox + 4.3, 0.9, oz + 2.9, this.accentMat));
    this.gasGroup = gas;
    this.gasGroup.visible = false;

    this.light = new THREE.PointLight('#ffe6bd', 60, 26, 2);
    this.light.position.set(ox, 3.0, oz);
    this.light.visible = false;
    g.add(this.light);

    this.group = g;
    this.group.visible = false;
    this.scene.add(g);

    this.entryPos = new THREE.Vector3(ox, 0, oz + 3.9);
    this.exitAnchor = new THREE.Vector3(ox, 0, oz + 4.4);
    this.fridgeAnchor = new THREE.Vector3(ox - 3.8, 0, oz);
  }

  _buildCollisions(isGas) {
    const c = this.collision;
    const ox = ORIGIN.x;
    const oz = ORIGIN.z;
    c.clear('interior');
    c.addBox(ox, oz - 5, 7, 1, 'interior');
    c.addBox(ox - 7, oz, 1, 6, 'interior');
    c.addBox(ox + 7, oz, 1, 6, 'interior');
    c.addBox(ox, oz + 6, 7, 1, 'interior');
    if (isGas) {
      c.addBox(ox - 5.85, oz, 0.6, 5.3, 'interior');
      c.addBox(ox, oz - 2.5, 2.3, 0.65, 'interior');
      c.addBox(ox, oz + 1.9, 2.3, 0.65, 'interior');
      c.addBox(ox + 5.5, oz + 1.6, 0.8, 1.65, 'interior');
      c.addBox(ox + 4.3, oz + 3.4, 1.1, 0.45, 'interior');
    } else {
      c.addBox(ox + 2.6, oz - 1.4, 2.6, 0.6, 'interior');
    }
  }

  get isInside() {
    return this.insidePoi !== null;
  }

  enter(poi, playerPosToRestore) {
    this.build();
    this.returnPos.copy(playerPosToRestore);
    this.insidePoi = poi;
    const isGas = !!poi && poi.category === 'gas';
    this.group.visible = true;
    this.light.visible = true;
    this.restaurantGroup.visible = !isGas;
    this.gasGroup.visible = isGas;
    this.pickupMarker.visible = !isGas;
    this.counterBag.visible = false;
    this._buildCollisions(isGas);
    const accents = ['#e8615a', '#2a9d8f', '#f2a541', '#457b9d', '#b56576'];
    const hash = [...poi.name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    this.accentMat.color.set(accents[hash % accents.length]);
    return {
      entryPos: this.entryPos.clone(),
      exitAnchor: this.exitAnchor.clone(),
      fridgeAnchor: this.fridgeAnchor.clone()
    };
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
