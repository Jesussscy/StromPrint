"use client";

import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

interface KaTeXBlockProps {
  math: string;
  displayMode?: boolean;
  highlightedVar?: string | null;
  variables?: { id: string; color: string }[];
}

export default function KaTeXBlock({ math, displayMode }: KaTeXBlockProps) {
  return displayMode ? (
    <div className="katex-block">
      <BlockMath math={math} />
    </div>
  ) : (
    <InlineMath math={math} />
  );
}
