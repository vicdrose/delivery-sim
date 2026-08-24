import * as THREE from 'three';

export function makeSharedMaterials() {
  return {
    solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
    windows: new THREE.MeshLambertMaterial({
      vertexColors: true,
      emissive: new THREE.Color('#ffd98a'),
      emissiveIntensity: 0
    })
  };
}

export function makeMarkerMaterial(hex, opacity) {
  return new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
}
