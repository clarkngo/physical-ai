export function captureGridBasePositions(grid) {
  const positions = grid.geometry.attributes.position;
  const base = new Float32Array(positions.count * 3);
  base.set(positions.array);
  return base;
}

export function updateGridGlitch(grids, elapsed, intensity) {
  if (!intensity || intensity <= 0.001) {
    grids.forEach(({ grid, basePositions }) => {
      const positions = grid.geometry.attributes.position;
      positions.array.set(basePositions);
      positions.needsUpdate = true;
    });
    return;
  }

  grids.forEach(({ grid, basePositions, wobbleScale = 1 }) => {
    const positions = grid.geometry.attributes.position;
    const arr = positions.array;

    for (let i = 0; i < positions.count; i += 1) {
      const bi = i * 3;
      const bx = basePositions[bi];
      const by = basePositions[bi + 1];
      const bz = basePositions[bi + 2];
      const wave =
        Math.sin(elapsed * 4.2 + i * 0.55) * 0.035 +
        Math.sin(elapsed * 7.1 + i * 0.17) * 0.018;
      const jitter = (Math.random() - 0.5) * 0.012 * intensity;

      arr[bi] = bx + (wave + jitter) * intensity * wobbleScale;
      arr[bi + 1] = by;
      arr[bi + 2] = bz + (wave * 0.6 + jitter) * intensity * wobbleScale;
    }

    positions.needsUpdate = true;
  });
}
