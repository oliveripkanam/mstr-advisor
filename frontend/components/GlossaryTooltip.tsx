"use client";
import React, { useEffect, useState } from 'react';

type Gloss = Record<string, { term: string; definition: string }>;

export default function GlossaryTooltip({ term }: { term: string }) {
  const [def, setDef] = useState<string | null>(null);

  useEffect(() => {
    fetch('/configs/glossary.yaml')
      .then((r) => r.text())
      .then((txt) => {
        // Minimal YAML parser for simple key: {term, definition}
        const lines = txt.split(/\r?\n/);
        const map: Gloss = {} as any;
        let current: string | null = null;
        lines.forEach((ln) => {
          if (/^[A-Za-z].*:/.test(ln) && !ln.startsWith(' ')) {
            current = ln.replace(':', '').trim();
            map[current] = { term: '', definition: '' };
          } else if (current && ln.trim().startsWith('term:')) {
            map[current].term = ln.split('term:')[1].trim().replace(/^"|"$/g, '');
          } else if (current && ln.trim().startsWith('definition:')) {
            map[current].definition = ln.split('definition:')[1].trim().replace(/^"|"$/g, '');
          }
        });
        const key = Object.keys(map).find((k) => k.toLowerCase() === term.toLowerCase());
        setDef(key ? map[key].definition : null);
      })
      .catch(() => setDef(null));
  }, [term]);

  if (!def) return <span className="underline decoration-dotted" title={term}>{term}</span>;
  return <span className="underline decoration-dotted" title={def}>{term}</span>;
}


