export function createMinimapController(canvas) {
  if (!canvas) throw new Error('Minimap requires a canvas element');

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Minimap canvas 2D context unavailable');

  const zoomLevels = [1.8, 2.2, 2.8];
  let zoomIndex = 1;
  let latestState = null;
  let scheduled = false;

  function cycleZoom() {
    zoomIndex = (zoomIndex + 1) % zoomLevels.length;
    return zoomLevels[zoomIndex];
  }

  function ensurePixelRatio() {
    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(64, Math.floor(rect.width));
    const height = Math.max(64, Math.floor(rect.height));

    const targetWidth = Math.floor(width * dpr);
    const targetHeight = Math.floor(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(state) {
    if (!canvas || !context || !state) return;

    ensurePixelRatio();

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
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
    context.rotate(-(state.yaw || 0));

    context.strokeStyle = state.isNight ? 'rgba(255,120,80,0.16)' : 'rgba(255,255,255,0.1)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = 'rgba(255, 255, 255, 0.12)';
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, -Math.PI / 3.5, Math.PI / 3.5);
    context.closePath();
    context.fill();

    const px = state.playerX || 0;
    const pz = state.playerZ || 0;

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

    (state.trees || []).forEach(t => {
      if (t?.userData?.health > 0) drawDot(t.position.x, t.position.z, '#2a5a18', 2.5);
    });

    (state.bushes || []).forEach(b => {
      if (b?.userData?.health > 0) drawDot(b.position.x, b.position.z, '#ff4444', 2);
    });

    (state.rocks || []).forEach(r => {
      const dx = (r.position.x - px) * scale;
      const dz = (r.position.z - pz) * scale;
      if (Math.abs(dx) < radius && Math.abs(dz) < radius) {
        context.fillStyle = '#7a7a5a';
        context.fillRect(dx - 2, dz - 2, 4, 4);
      }
    });

    (state.walls || []).forEach(w => {
      const dx = (w.position.x - px) * scale;
      const dz = (w.position.z - pz) * scale;
      if (Math.abs(dx) < radius && Math.abs(dz) < radius) {
        context.fillStyle = '#8a6a3a';
        context.fillRect(dx - 3, dz - 1, 6, 2);
      }
    });

    (state.bandits || []).forEach(b => {
      if (b?.userData?.health <= 0) return;
      const banditState = b?.userData?.state;
      const color =
        banditState === 'alert'
          ? '#ffdd00'
          : banditState === 'chase'
            ? '#ff2200'
            : '#cc3322';
      drawDot(b.position.x, b.position.z, color, 3);
    });

    // Player marker
    context.fillStyle = '#ffcc44';
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();

    // Facing indicator
    context.fillStyle = '#fff';
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(-3, 0);
    context.lineTo(3, 0);
    context.closePath();
    context.fill();

    // North label
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

  function render(state) {
    if (!canvas) return;
    latestState = state;
    if (scheduled) return;

    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (latestState) draw(latestState);
    });
  }

  function resize() {
    ensurePixelRatio();
    if (latestState) draw(latestState);
  }

  try {
    const ro = new ResizeObserver(() => resize());
    if (canvas.parentElement) ro.observe(canvas.parentElement);
  } catch (e) {
    // ResizeObserver unavailable or unsupported; safe to ignore.
  }

  return {
    render,
    cycleZoom,
    getZoom: () => zoomLevels[zoomIndex],
    resize,
  };
}