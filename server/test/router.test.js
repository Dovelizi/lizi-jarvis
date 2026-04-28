import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../src/router.js';

test('classifyIntent: 播放 keyword → control/play', () => {
  const r = classifyIntent('播放 周杰伦');
  assert.equal(r.kind, 'control');
  assert.equal(r.op, 'play');
  assert.equal(r.arg, '周杰伦');
});

test('classifyIntent: 暂停 → control/pause', () => {
  assert.equal(classifyIntent('暂停').op, 'pause');
});

test('classifyIntent: 自然语言 → chat', () => {
  assert.equal(classifyIntent('今天有点累').kind, 'chat');
});

test('classifyIntent: 音量 60 → control/volume', () => {
  const r = classifyIntent('音量 60');
  assert.equal(r.op, 'volume');
  assert.equal(r.arg, '60');
});
