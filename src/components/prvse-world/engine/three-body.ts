/**
 * Three-body gravitational simulation
 *
 * Initial conditions: Chenciner-Montgomery figure-8 periodic orbit (2000)
 * All three bodies of equal mass trace the same figure-8 path, offset by T/3.
 * Period T ≈ 6.3259 natural units (G = m = 1)
 *
 * Integration: Leapfrog / Störmer-Verlet (symplectic, energy-conserving)
 */

export interface Body {
  x: number; y: number
  vx: number; vy: number
}

/** Figure-8 initial conditions (equal masses, G = 1) */
export function initFigure8(): Body[] {
  return [
    { x: -0.97000436,  y:  0.24308753,  vx:  0.46620369,  vy:  0.43236573 },
    { x:  0.97000436,  y: -0.24308753,  vx:  0.46620369,  vy:  0.43236573 },
    { x:  0.0,          y:  0.0,          vx: -0.93240738,  vy: -0.86473146 },
  ]
}

const G = 1.0

function computeAccelerations(bodies: Body[]): Array<{ ax: number; ay: number }> {
  const acc = bodies.map(() => ({ ax: 0, ay: 0 }))
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[j].x - bodies[i].x
      const dy = bodies[j].y - bodies[i].y
      const r2 = dx * dx + dy * dy
      if (r2 < 1e-8) continue
      const inv_r3 = G / (r2 * Math.sqrt(r2))
      acc[i].ax += inv_r3 * dx
      acc[i].ay += inv_r3 * dy
      acc[j].ax -= inv_r3 * dx
      acc[j].ay -= inv_r3 * dy
    }
  }
  return acc
}

/**
 * Leapfrog step — one integration step of size dt.
 * Returns a new array (immutable update).
 */
export function stepBodies(bodies: Body[], dt: number): Body[] {
  const a0 = computeAccelerations(bodies)

  // Half velocity kick + full position drift
  const mid: Body[] = bodies.map((b, i) => ({
    x:  b.x  + (b.vx + 0.5 * a0[i].ax * dt) * dt,
    y:  b.y  + (b.vy + 0.5 * a0[i].ay * dt) * dt,
    vx: b.vx + 0.5 * a0[i].ax * dt,
    vy: b.vy + 0.5 * a0[i].ay * dt,
  }))

  // Second half velocity kick
  const a1 = computeAccelerations(mid)
  return mid.map((b, i) => ({
    ...b,
    vx: b.vx + 0.5 * a1[i].ax * dt,
    vy: b.vy + 0.5 * a1[i].ay * dt,
  }))
}
