import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSONS,
  DIFFICULTY_META,
  filterLessonsByDifficulty,
  countLessonsByDifficulty,
} from './curriculum';

test('every lesson has a valid difficulty level', () => {
  assert.equal(LESSONS.length, 20);
  for (const lesson of LESSONS) {
    assert.ok(
      lesson.difficulty === 'easy' || lesson.difficulty === 'medium' || lesson.difficulty === 'hard',
      `Lesson ${lesson.id} missing valid difficulty`
    );
    assert.ok(DIFFICULTY_META[lesson.difficulty].label.length > 0);
  }
});

test('countLessonsByDifficulty sums accurately across all difficulty tiers', () => {
  const counts = countLessonsByDifficulty(LESSONS);
  assert.equal(counts.all, LESSONS.length);
  assert.ok(counts.easy > 0);
  assert.ok(counts.medium > 0);
  assert.ok(counts.hard > 0);
  assert.equal(counts.easy + counts.medium + counts.hard, counts.all);
});

test('filterLessonsByDifficulty returns matching subsets', () => {
  const all = filterLessonsByDifficulty(LESSONS, 'all');
  const easy = filterLessonsByDifficulty(LESSONS, 'easy');
  const medium = filterLessonsByDifficulty(LESSONS, 'medium');
  const hard = filterLessonsByDifficulty(LESSONS, 'hard');

  assert.equal(all.length, LESSONS.length);
  assert.ok(easy.every((l) => l.difficulty === 'easy'));
  assert.ok(medium.every((l) => l.difficulty === 'medium'));
  assert.ok(hard.every((l) => l.difficulty === 'hard'));
  assert.ok(hard.some((l) => l.isBoss));
});
