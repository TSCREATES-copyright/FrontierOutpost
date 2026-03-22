export function createScene(THREE) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x8aabbf, 0.022);
  return scene;
}
