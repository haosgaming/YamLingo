import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLessonCompletion,
  calculateLessonReward,
  createDefaultProgress,
  purchaseShopItem,
  updateStreakOnActivity,
} from './gamification';

test('calculates rewards with boss and flawless bonuses', () => {
  const normal = calculateLessonReward({
    isBoss: false,
    alreadyCompleted: false,
    mistakesCount: 0,
  });
  assert.equal(normal.volts, 35); // 25 + 10 flawless
  assert.equal(normal.xp, 70);

  const boss = calculateLessonReward({
    isBoss: true,
    alreadyCompleted: false,
    mistakesCount: 0,
    remainingSeconds: 45,
  });
  assert.equal(boss.volts, 75); // 50 + 10 + 15 speed
});

test('streak freeze protects streak across a missed day', () => {
  const p = createDefaultProgress('2026-11-10');
  p.streakDays = 5;
  p.streakFreezes = 1;

  // Missed 2026-11-11, returned on 2026-11-12 (diffDays === 2)
  const after = updateStreakOnActivity(p, '2026-11-12');
  assert.equal(after.streakDays, 6);
  assert.equal(after.streakFreezes, 0);
  assert.equal(after.lastActiveDate, '2026-11-12');
});

test('shop purchases deduct volts and unlock themes/skins', () => {
  const p = createDefaultProgress('2026-11-10');
  p.volts = 100;

  const res = purchaseShopItem(p, 'theme-ha-blue');
  assert.equal(res.success, true);
  assert.equal(res.progress.volts, 60);
  assert.equal(res.progress.activeTheme, 'ha-blue');
  assert.equal(res.progress.unlockedThemes.includes('ha-blue'), true);

  const fail = purchaseShopItem(res.progress, 'skin-pcb-gold'); // costs 140
  assert.equal(fail.success, false);
});

test('applyLessonCompletion records completion without duplicates', () => {
  const p = createDefaultProgress('2026-11-10');
  const next = applyLessonCompletion(p, 'w1-1', { volts: 25, xp: 50 }, '2026-11-10');
  assert.deepEqual(next.completedLessons, ['w1-1']);
  const again = applyLessonCompletion(next, 'w1-1', { volts: 5, xp: 15 }, '2026-11-10');
  assert.deepEqual(again.completedLessons, ['w1-1']);
});
