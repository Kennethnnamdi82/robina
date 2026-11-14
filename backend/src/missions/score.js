// A verified run is scored on a 0–10,000 integer scale. The weights are
// versioned here so future balancing never silently changes stored results.
export const SCORE_VERSION = 1;
export const SCORE_WEIGHTS = Object.freeze({ time: 25, enemies: 25, survival: 20, accuracy: 15, optional: 15 });

export function scoreVerifiedRun({ durationSeconds, enemiesDefeated, expectedEnemies, remainingHealth,
  maxHealth, shotsFired, successfulHits, optionalCompleted, optionalTotal }) {
  const numbers = [durationSeconds, enemiesDefeated, expectedEnemies, remainingHealth, maxHealth,
    shotsFired, successfulHits, optionalCompleted, optionalTotal];
  if (numbers.some(value => !Number.isFinite(value) || value < 0) ||
      durationSeconds < 1 || durationSeconds > 172800 || maxHealth < 100 || maxHealth > 500 ||
      remainingHealth > maxHealth || expectedEnemies < 1 || expectedEnemies > 1000 ||
      enemiesDefeated > 10000 || shotsFired > 1000000 || successfulHits > shotsFired ||
      optionalCompleted > optionalTotal || optionalTotal > 32 ||
      numbers.slice(1).some(value => !Number.isInteger(value))) throw new Error('invalid_verified_stats');
  const clamp = value => Math.max(0, Math.min(1, value));
  const parts = {
    time: clamp((1800 - durationSeconds) / 1500), // Full at <=5m; zero at >=30m.
    enemies: clamp(enemiesDefeated / expectedEnemies),
    survival: clamp(remainingHealth / maxHealth),
    accuracy: shotsFired ? clamp(successfulHits / shotsFired) : 0,
    optional: optionalTotal ? clamp(optionalCompleted / optionalTotal) : 1,
  };
  return Math.round(Object.entries(SCORE_WEIGHTS).reduce((total, [key, weight]) => total + parts[key] * weight * 100, 0));
}
