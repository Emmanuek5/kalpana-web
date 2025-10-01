import React from "react";

export const CodeBlock = React.memo(
  ({ inline, className, children, ...props }: any) => {
    const extractText = React.useCallback((node: any): string => {
      if (typeof node === "string") return node;
      if (typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (node && typeof node === "object") {
        if (node.props && node.props.children) {
          return extractText(node.props.children);
        }
        return JSON.stringify(node, null, 2);
      }
      return "";
    }, []);

    const content = extractText(children);

    return inline ? (
      <code
        className="px-1.5 py-0.5 bg-zinc-800/50 text-emerald-400 rounded text-xs font-mono"
        {...props}
      >
        {content}
      </code>
    ) : (
      <code
        className={`block bg-zinc-900/50 p-3 rounded-lg my-2 text-xs overflow-x-auto border border-zinc-800/30 ${
          className || ""
        }`}
        {...props}
      >
        {content}
      </code>
    );
  }
);

CodeBlock.displayName = "CodeBlock";
