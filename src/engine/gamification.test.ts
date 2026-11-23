import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLessonCompletion,
  buildLast30DaysActivity,
  calculateLessonReward,
  createDefaultProgress,
  purchaseShopItem,
  summarizeActivity30Days,
  toggleSoundPreference,
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

test('applyLessonCompletion records completion without duplicates, increments daily activity, and tracks flawless count', () => {
  const p = createDefaultProgress('2026-11-10');
  const next = applyLessonCompletion(
    p,
    'w1-1',
    { volts: 25, xp: 50 },
    '2026-11-10',
    { flawless: true }
  );
  assert.deepEqual(next.completedLessons, ['w1-1']);
  assert.equal(next.activityByDate['2026-11-10'], 1);
  assert.equal(next.flawlessLessonsCount, 1);

  const again = applyLessonCompletion(
    next,
    'w1-1',
    { volts: 5, xp: 15 },
    '2026-11-10',
    { flawless: false }
  );
  assert.deepEqual(again.completedLessons, ['w1-1']);
  assert.equal(again.activityByDate['2026-11-10'], 2);
  assert.equal(again.flawlessLessonsCount, 1);
});

test('buildLast30DaysActivity returns 30 ordered days ending on todayStr with accurate summary', () => {
  const points = buildLast30DaysActivity(
    {
      '2026-10-20': 9, // outside 30-day window for 2026-11-23
      '2026-11-01': 2,
      '2026-11-22': 1,
      '2026-11-23': 3,
    },
    '2026-11-23'
  );

  assert.equal(points.length, 30);
  assert.equal(points[0].date, '2026-10-25');
  assert.equal(points[29].date, '2026-11-23');
  assert.equal(points[29].isToday, true);
  assert.equal(points[29].completions, 3);

  const summary = summarizeActivity30Days(points);
  assert.equal(summary.totalCompletions, 6);
  assert.equal(summary.activeDays, 3);
  assert.equal(summary.bestDayCount, 3);
  assert.equal(summary.averagePerActiveDay, 2);
});

test('toggleSoundPreference toggles individual audio channels cleanly', () => {
  const p = createDefaultProgress('2026-11-23');
  assert.equal(p.soundPreferences.typingFeedback, true);

  const afterTyping = toggleSoundPreference(p, 'typingFeedback');
  assert.equal(afterTyping.soundPreferences.typingFeedback, false);
  assert.equal(afterTyping.soundPreferences.uiClicks, true);
  assert.equal(afterTyping.soundPreferences.successFanfares, true);

  const afterFanfare = toggleSoundPreference(afterTyping, 'successFanfares');
  assert.equal(afterFanfare.soundPreferences.successFanfares, false);
  assert.equal(afterFanfare.soundPreferences.typingFeedback, false);
});
