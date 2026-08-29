'use client';

import React from 'react';

// Renders **bold**, *italic*, `code`, fenced ```code blocks```, bullet lists,
// numbered lists, and # headers as real formatting instead of raw markdown symbols.
// Deliberately dependency-free — no react-markdown install required.
function renderInline(text, keyPrefix) {
  let key = 0;

  const patterns = [
    { regex: /\*\*(.+?)\*\*/, wrap: (m) => <strong key={`${keyPrefix}-b-${key++}`}>{m}</strong> },
    { regex: /`(.+?)`/, wrap: (m) => <code key={`${keyPrefix}-c-${key++}`} className="bg-black/20 px-1 py-0.5 rounded text-[0.9em]">{m}</code> },
    { regex: /(?:^|[^*])\*([^*]+?)\*(?!\*)/, wrap: (m) => <em key={`${keyPrefix}-i-${key++}`}>{m}</em>, offsetGroup1: true },
    { regex: /_(.+?)_/, wrap: (m) => <em key={`${keyPrefix}-i2-${key++}`}>{m}</em> },
  ];

  const nodes = [];
  let cursor = 0;
  const remaining = text;

  while (cursor < remaining.length) {
    let earliestMatch = null;
    let earliestPattern = null;

    for (const p of patterns) {
      const m = remaining.slice(cursor).match(p.regex);
      if (m && (earliestMatch === null || m.index < earliestMatch.index)) {
        earliestMatch = m;
        earliestPattern = p;
      }
    }

    if (!earliestMatch) {
      nodes.push(remaining.slice(cursor));
      break;
    }

    const matchStart = cursor + earliestMatch.index;
    if (matchStart > cursor) nodes.push(remaining.slice(cursor, matchStart));
    nodes.push(earliestPattern.wrap(earliestMatch[1]));
    cursor = matchStart + earliestMatch[0].length;
  }

  return nodes;
}

export default function MarkdownLite({ text }) {
  if (!text) return null;
  const lines = text.split('\n');

  const elements = [];
  let listBuffer = [];
  let listType = null; // 'ul' | 'ol'
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = '';

  const flushList = (keyBase) => {
    if (listBuffer.length === 0) return;
    if (listType === 'ol') {
      elements.push(
        <ol key={`list-${keyBase}`} className="list-decimal list-inside space-y-0.5 my-1">
          {listBuffer.map((item, i) => <li key={i}>{renderInline(item, `ol-${keyBase}-${i}`)}</li>)}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`list-${keyBase}`} className="list-disc list-inside space-y-0.5 my-1">
          {listBuffer.map((item, i) => <li key={i}>{renderInline(item, `ul-${keyBase}-${i}`)}</li>)}
        </ul>
      );
    }
    listBuffer = [];
    listType = null;
  };

  const flushCodeBlock = (keyBase) => {
    elements.push(
      <pre key={`code-${keyBase}`} className="bg-black/30 border border-white/10 rounded-lg p-3 my-2 overflow-x-auto text-xs">
        <code>{codeBuffer.join('\n')}</code>
      </pre>
    );
    codeBuffer = [];
    codeLang = '';
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Fenced code block start/end (```)
    if (/^```/.test(trimmed)) {
      if (inCodeBlock) {
        flushCodeBlock(idx);
        inCodeBlock = false;
      } else {
        flushList(idx);
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      flushList(idx);
      const headerText = trimmed.replace(/^#{1,6}\s+/, '');
      elements.push(<p key={idx} className="font-semibold mt-2 mb-1">{renderInline(headerText, `h-${idx}`)}</p>);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
    if (bulletMatch) {
      if (listType && listType !== 'ul') flushList(idx);
      listType = 'ul';
      listBuffer.push(bulletMatch[1]);
      return;
    }

    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
    if (numberedMatch) {
      if (listType && listType !== 'ol') flushList(idx);
      listType = 'ol';
      listBuffer.push(numberedMatch[1]);
      return;
    }

    flushList(idx);
    if (trimmed === '') {
      elements.push(<div key={idx} className="h-2" />);
    } else {
      elements.push(<p key={idx} className="my-0.5">{renderInline(line, `p-${idx}`)}</p>);
    }
  });

  // If the AI's response ends mid-code-block (unterminated ```), flush what we have
  if (inCodeBlock && codeBuffer.length > 0) {
    flushCodeBlock('end');
  }
  flushList('end');

  return <div>{elements}</div>;
}