'use client';

/**
 * Markdown — Rendering markdown per le risposte dell'agente.
 * Stili pensati per le bolle chat scure; supporta tabelle GFM, grassetto, liste.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({ content, variant = 'chat' }: { content: string; variant?: 'chat' | 'doc' }) {
  const doc = variant === 'doc';
  const cls = {
    wrap: doc
      ? 'text-[15px] leading-relaxed text-slate-300 [&>*:first-child]:mt-0'
      : 'text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
    h1: doc ? 'text-2xl font-bold text-white mt-7 mb-3' : 'text-base font-bold text-white mt-3 mb-1.5',
    h2: doc ? 'text-lg font-bold text-white mt-7 mb-2' : 'text-sm font-bold text-white mt-3 mb-1.5',
    h3: doc ? 'text-base font-semibold text-violet-300 mt-5 mb-1.5' : 'text-sm font-semibold text-violet-300 mt-3 mb-1',
    p: doc ? 'my-2.5 leading-relaxed' : 'my-1.5',
  };
  return (
    <div className={cls.wrap}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={cls.h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={cls.h2}>{children}</h2>,
          h3: ({ children }) => <h3 className={cls.h3}>{children}</h3>,
          p: ({ children }) => <p className={cls.p}>{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-white/10" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-violet-500/40 pl-3 my-2 text-slate-400">{children}</blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <code className={`${className} font-mono text-[12px]`}>{children}</code>;
            }
            return (
              <code className="px-1 py-0.5 rounded bg-white/10 font-mono text-[12px] text-amber-300">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 p-3 rounded-lg bg-black/40 border border-white/10 overflow-x-auto text-[12px]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-[12px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.06]">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-slate-200 border-b border-white/10 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-white/5 text-slate-300 align-top">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
