'use client';

import React from 'react';

// Renders **bold**, *italic*, `code`, bullet lists (- or *), numbered lists,
// and ## headers as real formatting instead of raw markdown symbols.
// Deliberately dependency-free — no react-markdown install required.
function renderInline(text, keyPrefix) {
  const parts = [];
  let remaining = text;
  let key = 0;

  // Order matters: bold before italic so **x** isn't half-eaten by the italic pass
  const patterns = [
    { regex: /\*\*(.+?)\*\*/, wrap: (m) => <strong key={`${keyPrefix}-b-${key++}`}>{m}</strong> },
    { regex: /`(.+?)`/, wrap: (m) => <code key={`${keyPrefix}-c-${key++}`} className="bg-black/20 px-1 py-0.5 rounded text-[0.9em]">{m}</code> },
    { regex: /\*(.+?)\*/, wrap: (m) => <em key={`${keyPrefix}-i-${key++}`}>{m}</em> },
  ];

  const nodes = [];
  let cursor = 0;

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

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (/^#{1,3}\s+/.test(trimmed)) {
      flushList(idx);
      const headerText = trimmed.replace(/^#{1,3}\s+/, '');
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
  flushList('end');

  return <div>{elements}</div>;
}