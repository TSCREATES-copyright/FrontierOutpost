export function createCamera(THREE, width, height) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 500);
  camera.position.set(0, 1.7, 0);
  return camera;
}
