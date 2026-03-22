export function createGameLoop(updateFrame, renderFrame) {
  function frame() {
    requestAnimationFrame(frame);
    updateFrame();
    renderFrame();
  }
  return frame;
}
