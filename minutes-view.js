/* Minimal, dependency-free Markdown renderer for generated meeting minutes.
   Everything is escaped before inline formatting, so model output can never
   inject markup or scripts into the page. */
const ESCAPES = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ESCAPES[character]);
}

function inline(value) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return text;
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function isTableStart(lines, index) {
  return /^\s*\|.*\|\s*$/.test(lines[index] || '') &&
         /^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1] || '');
}

const BLOCK = /^\s*([-*+]\s|>\s?|#{1,6}\s|\d+[.)]\s|\|)/;

export function renderMinutesMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (/^\s*```/.test(line)) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(escapeHtml(lines[index]));
        index += 1;
      }
      index += 1;
      out.push('<pre><code>' + code.join('\n') + '</code></pre>');
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = tableCells(lines[index]);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        const row = tableCells(lines[index]);
        rows.push(header.map((_, column) => `<td>${inline(row[column] ?? '')}</td>`).join(''));
        index += 1;
      }
      out.push('<div class="table-wrap"><table><thead><tr>' +
               header.map(cell => `<th>${inline(cell)}</th>`).join('') +
               '</tr></thead><tbody>' +
               rows.map(row => `<tr>${row}</tr>`).join('') +
               '</tbody></table></div>');
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quotes = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quotes.push(inline(lines[index].replace(/^\s*>\s?/, '')));
        index += 1;
      }
      out.push('<blockquote>' + quotes.map(text => `<p>${text}</p>`).join('') + '</blockquote>');
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(inline(lines[index].replace(/^\s*[-*+]\s+/, '')));
        index += 1;
      }
      out.push('<ul>' + items.map(text => `<li>${text}</li>`).join('') + '</ul>');
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(inline(lines[index].replace(/^\s*\d+[.)]\s+/, '')));
        index += 1;
      }
      out.push('<ol>' + items.map(text => `<li>${text}</li>`).join('') + '</ol>');
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !BLOCK.test(lines[index])) {
      paragraph.push(inline(lines[index]));
      index += 1;
    }
    if (paragraph.length) out.push('<p>' + paragraph.join('<br>') + '</p>');
  }
  return out.join('\n');
}
