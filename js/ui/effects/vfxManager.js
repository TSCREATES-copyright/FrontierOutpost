export function initVfx(THREE, scene) {
  const pool = [];
  const active = [];
  const partGeo = new THREE.SphereGeometry(0.05, 4, 4); partGeo.userData = { shared: true };

  function getMesh(color) {
    let m = pool.pop();
    if (!m) {
      const mat = new THREE.MeshLambertMaterial({ color, transparent: true });
      m = new THREE.Mesh(partGeo, mat);
      m.active = false;
      m.life = 0;
    } else {
      if (m.material) m.material.color.setHex(color);
    }
    scene.add(m);
    return m;
  }

  function spawnParticle(pos, color) {
    for (let i = 0; i < 5; i++) {
      const m = getMesh(color);
      m.position.copy(pos).addScalar(0.2 * (Math.random() - 0.5));
      m.active = true;
      m.life = 0.6;
      m.velocity = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
      active.push(m);
    }
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        scene.remove(p);
        active.splice(i, 1);
        pool.push(p);
        continue;
      }
      p.velocity.y -= 9.8 * dt;
      p.position.addScaledVector(p.velocity, dt);
      if (p.material) p.material.opacity = p.life / 0.6;
    }
  }

  window.VFX = { spawnParticle, update };
}