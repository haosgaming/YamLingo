import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAchievements, summarizeAchievements } from './achievements';
import { createDefaultProgress } from './gamification';

test('default progress starts with all 8 achievements locked and accurate initial counts', () => {
  const progress = createDefaultProgress('2026-11-23');
  const statuses = evaluateAchievements(progress);
  const summary = summarizeAchievements(statuses);

  assert.equal(statuses.length, 8);
  assert.equal(summary.unlockedCount, 0);
  assert.equal(summary.totalCount, 8);

  const streakBadge = statuses.find((s) => s.id === 'streak-3');
  assert.equal(streakBadge?.current, 1);
  assert.equal(streakBadge?.unlocked, false);
});

test('unlocks Completed 10 lessons and Used 50 hints milestones accurately', () => {
  const progress = createDefaultProgress('2026-11-23');
  progress.completedLessons = [
    'w1-1',
    'w1-2',
    'w1-3',
    'w1-4',
    'w2-1',
    'w2-2',
    'w2-3',
    'w2-4',
    'w3-1',
    'w3-2',
  ];
  progress.hintsUsedCount = 50;
  progress.flawlessLessonsCount = 3;
  progress.streakDays = 3;
  progress.unlockedThemes = ['minimal-dark', 'light', 'ha-blue'];
  progress.unlockedSkins = ['pcb-emerald', 'pcb-obsidian'];

  const statuses = evaluateAchievements(progress);
  const byId = Object.fromEntries(statuses.map((s) => [s.id, s]));

  assert.equal(byId['first-lesson'].unlocked, true);
  assert.equal(byId['lessons-10'].unlocked, true);
  assert.equal(byId['lessons-10'].current, 10);
  assert.equal(byId['lessons-all'].unlocked, false);
  assert.equal(byId['lessons-all'].current, 10);
  assert.equal(byId['hints-50'].unlocked, true);
  assert.equal(byId['hints-50'].current, 50);
  assert.equal(byId['flawless-3'].unlocked, true);
  assert.equal(byId['streak-3'].unlocked, true);
  assert.equal(byId['collector-2'].unlocked, true);
  assert.equal(byId['boss-slayer'].current, 2);
  assert.equal(byId['boss-slayer'].unlocked, false);
});

test('caps progress bar values cleanly at target maximum', () => {
  const progress = createDefaultProgress('2026-11-23');
  progress.hintsUsedCount = 120;
  const statuses = evaluateAchievements(progress);
  const hintsBadge = statuses.find((s) => s.id === 'hints-50');

  assert.equal(hintsBadge?.current, 50);
  assert.equal(hintsBadge?.progressPct, 100);
  assert.equal(hintsBadge?.unlocked, true);
});
