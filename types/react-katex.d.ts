declare module "react-katex" {
  import { ComponentType } from "react";
  interface MathProps {
    math: string;
    displayMode?: boolean;
    throwOnError?: boolean;
    errorColor?: string;
    renderGroupEnd?: () => void;
    script?: boolean;
    output?: "html" | "mathml";
    trust?: boolean;
    strict?: boolean | string;
    macros?: Record<string, string>;
    maxSize?: number;
    maxExpand?: number;
  }
  export const InlineMath: ComponentType<MathProps>;
  export const BlockMath: ComponentType<MathProps>;
}
