import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeParseBrainOutput } from '../src/claude.js';

test('整体 JSON 解析', () => {
  const r = safeParseBrainOutput({ raw: '{"say":"hi","play":[{"name":"a","artist":"b"}]}' });
  assert.equal(r.say, 'hi');
  assert.equal(r.play.length, 1);
  assert.equal(r.play[0].name, 'a');
});

test('```json``` 代码块解析', () => {
  const raw = 'sure!\n```json\n{"say":"ok","play":[]}\n```';
  const r = safeParseBrainOutput({ raw });
  assert.equal(r.say, 'ok');
});

test('裸大括号回退解析', () => {
  const raw = 'prefix {"say":"x","play":[]} suffix';
  const r = safeParseBrainOutput({ raw });
  assert.equal(r.say, 'x');
});

test('纯文本兜底', () => {
  const r = safeParseBrainOutput({ raw: '我在打盹' });
  assert.equal(r.say, '我在打盹');
  assert.deepEqual(r.play, []);
});

test('空输入', () => {
  const r = safeParseBrainOutput({ raw: '' });
  assert.ok(r.say.length > 0);
  assert.deepEqual(r.play, []);
});

test('play 数组截断到 5 首', () => {
  const arr = Array.from({ length: 10 }, (_, i) => ({ name: 's' + i, artist: 'a' }));
  const r = safeParseBrainOutput({ raw: JSON.stringify({ say: 'x', play: arr }) });
  assert.equal(r.play.length, 5);
});

test('Claude Code CLI envelope: result 内嵌业务 JSON', () => {
  const envelope = JSON.stringify({
    type: 'result', subtype: 'success', is_error: false,
    result: '{"say":"放首慢的","play":[{"name":"晴天","artist":"周杰伦"}]}',
    session_id: 'x', total_cost_usd: 0.001,
  });
  const r = safeParseBrainOutput({ raw: envelope });
  assert.equal(r.say, '放首慢的');
  assert.equal(r.play.length, 1);
  assert.equal(r.play[0].artist, '周杰伦');
});

test('Claude Code CLI envelope: result 是纯文本（无业务 JSON）', () => {
  const envelope = JSON.stringify({
    type: 'result', subtype: 'success', result: '请问你在哪个城市？',
  });
  const r = safeParseBrainOutput({ raw: envelope });
  assert.equal(r.say, '请问你在哪个城市？');
  assert.deepEqual(r.play, []);
});

test('Claude Code CLI envelope: result 含 ```json``` 代码块', () => {
  const envelope = JSON.stringify({
    type: 'result',
    result: '好的\n```json\n{"say":"ok","play":[]}\n```',
  });
  const r = safeParseBrainOutput({ raw: envelope });
  assert.equal(r.say, 'ok');
});
