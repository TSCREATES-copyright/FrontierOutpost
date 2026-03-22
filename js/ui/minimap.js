export function createMinimapController(canvas) {
  const context = canvas?.getContext('2d');
  const zoomLevels = [1.8, 2.2, 2.8];
  let zoomIndex = 1;

  function cycleZoom() {
    zoomIndex = (zoomIndex + 1) % zoomLevels.length;
    return zoomLevels[zoomIndex];
  }

  function render(state) {
    if (!canvas || !context) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = zoomLevels[zoomIndex];

    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();

    context.fillStyle = state.isNight ? '#050d15' : '#1a2810';
    context.fillRect(0, 0, width, height);

    context.translate(centerX, centerY);
    context.rotate(-state.yaw);

    context.strokeStyle = state.isNight ? 'rgba(255,120,80,0.16)' : 'rgba(255,255,255,0.1)';
    context.lineWidth = 1;
    context.beginPath(); context.arc(0, 0, radius * 0.35, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(0, 0, radius * 0.7, 0, Math.PI * 2); context.stroke();

    context.fillStyle = 'rgba(255, 255, 255, 0.12)';
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, -Math.PI / 3.5, Math.PI / 3.5);
    context.closePath();
    context.fill();

    const px = state.playerX;
    const pz = state.playerZ;

    const drawDot = (x, z, color, r = 2) => {
      const dx = (x - px) * scale;
      const dz = (z - pz) * scale;
      if (Math.abs(dx) < radius && Math.abs(dz) < radius) {
        context.fillStyle = color;
        context.beginPath();
        context.arc(dx, dz, r, 0, Math.PI * 2);
        context.fill();
      }
    };

    state.trees.forEach(t => { if (t.userData.health > 0) drawDot(t.position.x, t.position.z, '#2a5a18', 2.5); });
    state.bushes.forEach(b => { if (b.userData.health > 0) drawDot(b.position.x, b.position.z, '#ff4444', 2); });
    state.rocks.forEach(r => {
      const dx = (r.position.x - px) * scale;
      const dz = (r.position.z - pz) * scale;
      if (Math.abs(dx) < radius && Math.abs(dz) < radius) {
        context.fillStyle = '#7a7a5a';
        context.fillRect(dx - 2, dz - 2, 4, 4);
      }
    });

    state.walls.forEach(w => {
      const dx = (w.position.x - px) * scale;
      const dz = (w.position.z - pz) * scale;
      if (Math.abs(dx) < radius && Math.abs(dz) < radius) {
        context.fillStyle = '#8a6a3a';
        context.fillRect(dx - 3, dz - 1, 6, 2);
      }
    });

    state.bandits.forEach(b => {
      if (b.userData.health <= 0) return;
      const color = b.userData.state === 'alert' ? '#ffdd00' : b.userData.state === 'chase' ? '#ff2200' : '#cc3322';
      drawDot(b.position.x, b.position.z, color, 3);
    });

    context.fillStyle = '#ffcc44';
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#fff';
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(-3, 0);
    context.lineTo(3, 0);
    context.closePath();
    context.fill();

    context.fillStyle = '#9fd9ff';
    context.font = 'bold 10px sans-serif';
    context.textAlign = 'center';
    context.fillText('N', 0, -radius + 12);

    context.restore();
    context.strokeStyle = 'rgba(200,160,80,0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    context.stroke();
  }

  return { render, cycleZoom, getZoom: () => zoomLevels[zoomIndex] };
}
