import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMinutesMarkdown} from '../minutes-view.js';

test('minutes render headings, lists, tables and emphasis', () => {
  const html = renderMinutesMarkdown([
    '# 通用纪要',
    '',
    '## 议题',
    '- **结论**：照常推进',
    '',
    '| 任务 | 负责人 |',
    '|---|---|',
    '| 发通知 | 未明确 |',
  ].join('\n'));
  assert.match(html, /<h1>通用纪要<\/h1>/);
  assert.match(html, /<h2>议题<\/h2>/);
  assert.match(html, /<li><strong>结论<\/strong>：照常推进<\/li>/);
  assert.match(html, /<th>任务<\/th><th>负责人<\/th>/);
  assert.match(html, /<td>发通知<\/td><td>未明确<\/td>/);
});

test('model output cannot inject markup through the minutes renderer', () => {
  const html = renderMinutesMarkdown('# <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>');
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
