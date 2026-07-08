const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLimit, MAX_LIMIT } = require('../../src/utils/pagination');

test('parseLimit returns the fallback when the value is missing or invalid', () => {
    assert.equal(parseLimit(undefined), 100);
    assert.equal(parseLimit('not-a-number'), 100);
    assert.equal(parseLimit('-5'), 100);
    assert.equal(parseLimit('0'), 100);
});

test('parseLimit honors a custom fallback', () => {
    assert.equal(parseLimit(undefined, 25), 25);
});

test('parseLimit passes through valid values under the cap', () => {
    assert.equal(parseLimit('10'), 10);
    assert.equal(parseLimit(50), 50);
});

test('parseLimit caps values above MAX_LIMIT', () => {
    assert.equal(parseLimit(999999), MAX_LIMIT);
    assert.equal(parseLimit(String(MAX_LIMIT + 1)), MAX_LIMIT);
});
