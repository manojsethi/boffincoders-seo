/**
 * Minimal markdown renderer for report sections.
 * We handle a small subset on purpose — report bodies come from our own builders so we know the
 * grammar. Avoids pulling in a markdown dep for one feature.
 *
 * Supported:
 *   ## heading / ### heading
 *   - bullet list  (continuous block becomes <ul>)
 *   **bold**
 *   `code`
 *   [text](url)
 *   blank line = new paragraph
 */
import type { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  let i = 0;
  let buf = '';
  const flush = (): void => {
    if (buf) {
      tokens.push(buf);
      buf = '';
    }
  };
  while (i < text.length) {
    // bold **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        tokens.push(
          <strong key={tokens.length} className="font-semibold text-text">
            {text.slice(i + 2, end)}
          </strong>,
        );
        i = end + 2;
        continue;
      }
    }
    // inline code `...`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        tokens.push(
          <code key={tokens.length} className="rounded bg-surface-2 px-1 py-0.5 text-[12px] font-mono">
            {text.slice(i + 1, end)}
          </code>,
        );
        i = end + 1;
        continue;
      }
    }
    // link [text](url)
    if (text[i] === '[') {
      const close = text.indexOf(']', i + 1);
      if (close !== -1 && text[close + 1] === '(') {
        const paren = text.indexOf(')', close + 2);
        if (paren !== -1) {
          flush();
          const label = text.slice(i + 1, close);
          const url = text.slice(close + 2, paren);
          tokens.push(
            <a
              key={tokens.length}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-accent-hover hover:underline break-all"
            >
              {label}
            </a>,
          );
          i = paren + 1;
          continue;
        }
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return tokens;
}

type Block =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'paragraph'; text: string };

function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = (): void => {
    if (para.length > 0) {
      blocks.push({ kind: 'paragraph', text: para.join(' ').trim() });
      para = [];
    }
  };
  const flushList = (): void => {
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  };
  // Cheap pipe-table detection: a header row + `| --- |` separator + ≥1 body row.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushPara();
      flushList();
      blocks.push({ kind: 'heading', level: 3, text: line.slice(4) });
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara();
      flushList();
      blocks.push({ kind: 'heading', level: 2, text: line.slice(3) });
      continue;
    }
    // Table block — current line is header, next must be separator
    if (line.startsWith('|') && lines[i + 1]?.match(/^\s*\|?\s*[-: |]+\s*\|?\s*$/)) {
      flushPara();
      flushList();
      const head = line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());
      const body: string[][] = [];
      i += 2; // skip separator
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const row = lines[i]!.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        body.push(row);
        i++;
      }
      i--; // back off one since for-loop will increment
      blocks.push({ kind: 'table', head, rows: body });
      continue;
    }
    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      flushPara();
      list.push(listMatch[1]!);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

export function MarkdownBlock({ body }: { body: string }): JSX.Element {
  const blocks = parseBlocks(body);
  return (
    <div className="space-y-3 text-sm text-text-muted leading-relaxed">
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          const Tag = b.level === 2 ? 'h3' : 'h4';
          return (
            <Tag
              key={i}
              className={
                b.level === 2
                  ? 'text-sm font-semibold text-text mt-2'
                  : 'text-xs uppercase tracking-wider text-text-subtle mt-1'
              }
            >
              {renderInline(b.text)}
            </Tag>
          );
        }
        if (b.kind === 'list') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {b.items.map((it, k) => (
                <li key={k}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === 'table') {
          return (
            <div key={i} className="overflow-x-auto">
              <table className="text-xs border border-border rounded-md overflow-hidden">
                <thead className="bg-surface-2 text-text-subtle uppercase tracking-wider text-[10px]">
                  <tr>
                    {b.head.map((h, k) => (
                      <th key={k} className="px-3 py-1.5 text-left font-medium">{renderInline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr key={r} className="border-t border-border/60">
                      {row.map((cell, c) => (
                        <td key={c} className="px-3 py-1.5 tabular-nums text-text">{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={i}>{renderInline(b.text)}</p>;
      })}
    </div>
  );
}
