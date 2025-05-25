'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkSlug from 'remark-slug';
import rehypeKatex from 'rehype-katex';
import rehypePrism from 'rehype-prism-plus';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  sourcePageNumber?: number | null;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, sourcePageNumber }) => {
  if (!content) return null;

  return (
    <div className="markdown-container">
      {sourcePageNumber && (
        <div className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded inline-block mb-3">
          Page {sourcePageNumber}
        </div>
      )}
      <div className="prose prose-invert prose-pre:bg-gray-800/80 prose-pre:border prose-pre:border-gray-700 max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, remarkSlug]}
          rehypePlugins={[rehypeKatex, [rehypePrism, { ignoreMissing: true }], rehypeRaw]}
          components={{
            h1: ({ node, ...props }) => (
              <h1 id={`heading-${props.children?.toString().toLowerCase().replace(/\s+/g, '-')}`} className="text-2xl font-bold my-4 border-b border-gray-700 pb-2 group" {...props}>
                {props.children}
                <a href={`#heading-${props.children?.toString().toLowerCase().replace(/\s+/g, '-')}`} className="ml-2 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity">
                  #
                </a>
              </h1>
            ),
            h2: ({ node, ...props }) => (
              <h2 id={`heading-${props.children?.toString().toLowerCase().replace(/\s+/g, '-')}`} className="text-xl font-bold mt-8 mb-4 border-b border-gray-700 pb-2 group" {...props}>
                {props.children}
                <a href={`#heading-${props.children?.toString().toLowerCase().replace(/\s+/g, '-')}`} className="ml-2 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity">
                  #
                </a>
              </h2>
            ),
            h3: ({ node, ...props }) => (
              <h3 id={`heading-${props.children?.toString().toLowerCase().replace(/\s+/g, '-')}`} className="text-lg font-semibold mt-6 mb-3 group" {...props}>
                {props.children}
                <a href={`#heading-${props.children?.toString().toLowerCase().replace(/\s+/g, '-')}`} className="ml-2 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity">
                  #
                </a>
              </h3>
            ),
            code: ({ node, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';
              
              if (match) {
                return (
                  <div className="relative group">
                    {language && (
                      <div className="absolute right-2 top-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded opacity-60">
                        {language}
                      </div>
                    )}
                    <pre className={className}>
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                    <button 
                      className="absolute top-2 right-12 p-1.5 rounded bg-gray-700/50 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-700 hover:text-gray-200 transition-all"
                      onClick={() => {
                        navigator.clipboard.writeText(String(children));
                      }}
                      title="Copy code"
                    >
                      Copy
                    </button>
                  </div>
                );
              }
              
              return (
                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300" {...props}>
                  {children}
                </code>
              );
            },
            a: ({ node, ...props }) => (
              <a 
                {...props} 
                className="text-blue-400 hover:text-blue-300 hover:underline"
                target={props.href?.startsWith('http') ? '_blank' : undefined}
                rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              />
            ),
            img: ({ node, ...props }) => (
              <div className="my-6">
                <img
                  {...props}
                  className="mx-auto rounded-lg max-h-96 object-contain border border-gray-700"
                  loading="lazy"
                  alt={props.alt || 'Image'}
                />
                {props.alt && (
                  <p className="text-center text-sm text-gray-400 mt-2">{props.alt}</p>
                )}
              </div>
            ),
            blockquote: ({ node, ...props }) => (
              <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 bg-gray-800/30 rounded-r" {...props} />
            ),
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-gray-700 border border-gray-700 rounded" {...props} />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-gray-800" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" {...props} />
            ),
            td: ({ node, ...props }) => (
              <td className="px-4 py-3 text-sm border-t border-gray-700" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownRenderer; 