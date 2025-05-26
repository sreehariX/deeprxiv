'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  FileText, 
  Home,
  MessageCircle,
  ExternalLink,
  Share2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Types
interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    index: string;
    type: string;
    title: string;
    similarity_score: number;
    page_number?: number;
  }>;
  highlighted_images?: Array<{
    id: string;
    page: number;
    url: string;
    text_preview: string;
  }>;
  created_at: string;
}

interface ChatSession {
  id: number;
  session_id: string;
  title: string;
  paper_id?: number;
  paper_title?: string;
  arxiv_id?: string;
  is_public: boolean;
  share_url?: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

const BACKEND_URL = 'http://localhost:8000';

export default function SharedChatPage() {
  const params = useParams();
  const share_url = params?.share_url as string;
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (share_url) {
      loadSharedChat();
    }
  }, [share_url]);

  const loadSharedChat = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/chat/share/${share_url}`);
      
      if (response.ok) {
        const data = await response.json();
        setSession(data);
      } else if (response.status === 404) {
        setError('This shared chat was not found or is no longer available.');
      } else {
        setError('Failed to load the shared chat.');
      }
    } catch (error) {
      console.error('Error loading shared chat:', error);
      setError('Failed to load the shared chat.');
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-100">
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-auto py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-blue-600 hover:text-blue-700 flex items-center self-start mt-1">
                <Home className="w-6 h-6" />
                <span className="sr-only">Home</span>
              </Link>
              <span className="text-black font-semibold text-2xl ml-1 mr-2 self-center">deeprxiv</span>
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-slate-700">Loading shared chat...</h2>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading shared conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-slate-100">
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-auto py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-blue-600 hover:text-blue-700 flex items-center self-start mt-1">
                <Home className="w-6 h-6" />
                <span className="sr-only">Home</span>
              </Link>
              <span className="text-black font-semibold text-2xl ml-1 mr-2 self-center">deeprxiv</span>
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-slate-700">Shared Chat Not Found</h2>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <MessageCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Chat Not Available</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <Link 
              href="/chat" 
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start New Chat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-auto py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-blue-600 hover:text-blue-700 flex items-center self-start mt-1">
              <Home className="w-6 h-6" />
              <span className="sr-only">Home</span>
            </Link>
            <span className="text-black font-semibold text-2xl ml-1 mr-2 self-center">deeprxiv</span>
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-slate-700 truncate max-w-xl" title={session.title}>
                {session.title}
              </h2>
              {session.paper_title && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Paper: {session.paper_title}
                </p>
              )}
              <p className="text-xs text-blue-600 mt-0.5">Shared conversation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Share2 className="w-4 h-4" />
              Copy Link
            </button>
            <Link
              href="/chat"
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start Your Own Chat
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col max-h-[calc(100vh-4rem)] overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
            {session.messages.length > 0 ? (
              session.messages.map((msg, index) => (
                <div key={index} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block max-w-4xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'} p-4 rounded-lg`}>
                    {msg.role === 'user' ? (
                      <p className="text-white">{msg.content}</p>
                    ) : (
                      <div className="prose prose-slate max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code: ({ children, className }) => {
                              const isInline = !className;
                              if (isInline) {
                                return <code className="bg-slate-200 px-1 py-0.5 rounded text-sm">{children}</code>;
                              }
                              return <pre className="bg-slate-200 p-4 rounded-lg overflow-x-auto"><code>{children}</code></pre>;
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No messages yet</h3>
                <p className="text-slate-600">This shared conversation doesn't have any messages.</p>
              </div>
            )}
          </div>

          {/* Footer with action */}
          <div className="bg-slate-50 border-t border-slate-200 p-6 text-center">
            <p className="text-slate-600 mb-4">This is a shared conversation. Want to start your own?</p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Start New Chat
            </Link>
          </div>
        </main>

        {/* Right Sidebar - Sources and Images */}
        {session.messages.length > 0 && (
          <aside className="w-80 bg-slate-50 p-6 border-l border-slate-200 flex flex-col max-h-[calc(100vh-4rem)]">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Source Information</h3>
            
            {/* Get sources from latest assistant message */}
            {(() => {
              const lastAssistantMessage = [...session.messages].reverse().find(m => m.role === 'assistant');
              const sources = lastAssistantMessage?.sources || [];
              const images = lastAssistantMessage?.highlighted_images || [];
              
              return (
                <>
                  {/* Images */}
                  {images.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Source Pages (Images)</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((image, index) => (
                          <div key={index} className="aspect-w-3 aspect-h-4 bg-slate-200 rounded-md overflow-hidden">
                            <img
                              src={image.url}
                              alt={`Source page ${image.page}`}
                              className="object-cover w-full h-full cursor-pointer hover:opacity-80"
                              onClick={() => window.open(image.url, '_blank')}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PDF Link */}
                  {session.arxiv_id && (
                    <button
                      onClick={() => window.open(`https://arxiv.org/pdf/${session.arxiv_id}.pdf`, '_blank')}
                      className="w-full flex items-center justify-center gap-2 border border-blue-600 text-blue-600 py-2.5 px-4 rounded-lg hover:bg-blue-50 transition-colors mb-6 text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      View in PDF
                    </button>
                  )}

                  {/* Sources */}
                  {sources.length > 0 && (
                    <div className="mb-6 flex-grow overflow-y-auto space-y-4">
                      <div className="bg-slate-100 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Sources Used</h4>
                        <div className="space-y-2">
                          {sources.map((source, index) => (
                            <div key={index} className="text-xs">
                              <div className="font-medium text-slate-900">
                                [{source.index}] {source.title}
                              </div>
                              <div className="text-slate-600">
                                Type: {source.type} | Score: {(source.similarity_score * 100).toFixed(1)}%
                                {source.page_number && ` | Page: ${source.page_number}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Bottom Navigation */}
            <div className="mt-auto border-t border-slate-200 pt-4">
              <Link href={session.arxiv_id ? `/abs/${session.arxiv_id}` : '/papers'} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span>Back to {session.arxiv_id ? 'Paper' : 'Papers'}</span>
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
} 