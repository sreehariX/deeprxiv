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
  Share2,
  Check,
  Copy,
  Database,
  X,
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'motion/react';
import ChainOfThought from '@/components/ChainOfThought';
import ChatSidebar from '@/components/ChatSidebar';

// Types
interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  chain_of_thought?: string;
  model_used?: string;
  sources?: Array<{
    index: string;
    type: string;
    title: string;
    similarity_score: number;
    page_number?: number;
    section_id?: string;
    chunk_index?: number;
    estimated_page?: string | number;
    arxiv_id?: string;
    text?: string;
  }>;
  citations?: string[];
  images?: Array<{
    url: string;
    title?: string;
    description?: string;
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
  const [copySuccess, setCopySuccess] = useState(false);
  const [sourcesSidebarOpen, setSourcesSidebarOpen] = useState(true);
  const [currentSources, setCurrentSources] = useState<{
    sources: Array<{
      index: string;
      type: string;
      title: string;
      similarity_score: number;
      page_number?: number;
      section_id?: string;
      chunk_index?: number;
      estimated_page?: string | number;
      arxiv_id?: string;
      text?: string;
    }>;
    citations?: string[];
    images?: Array<{
      url: string;
      title?: string;
      description?: string;
    }>;
    highlighted_images?: Array<{
      id: string;
      page: number;
      url: string;
      text_preview: string;
    }>;
  }>({ sources: [], citations: [], images: [], highlighted_images: [] });

  useEffect(() => {
    if (share_url) {
      loadSharedChat();
    }
  }, [share_url]);

  // Set current sources when session loads
  useEffect(() => {
    if (session && session.messages.length > 0) {
      const lastAssistantMessage = [...session.messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMessage) {
        setCurrentSources({
          sources: lastAssistantMessage.sources || [],
          citations: lastAssistantMessage.citations || [],
          images: lastAssistantMessage.images || [],
          highlighted_images: lastAssistantMessage.highlighted_images || []
        });
      }
    }
  }, [session]);

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
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                  <Home className="w-6 h-6" />
                </Link>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-white">deep</span>
                  <span className="text-2xl font-bold text-blue-400">rxiv</span>
                </div>
                <div className="h-6 w-px bg-gray-600"></div>
                <span className="text-gray-300">Loading shared chat...</span>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"
            />
            <h3 className="text-lg font-medium text-white mb-2">Loading Conversation</h3>
            <p className="text-gray-400">Please wait while we fetch the shared chat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                  <Home className="w-6 h-6" />
                </Link>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-white">deep</span>
                  <span className="text-2xl font-bold text-blue-400">rxiv</span>
                </div>
                <div className="h-6 w-px bg-gray-600"></div>
                <span className="text-red-400">Chat Not Found</span>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto px-6"
          >
            <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Chat Not Available</h3>
            <p className="text-gray-400 mb-8 leading-relaxed">{error}</p>
            <div className="space-y-3">
              <Link 
                href="/chat" 
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start New Chat
              </Link>
              <Link 
                href="/" 
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-700 text-gray-200 font-medium rounded-lg hover:bg-gray-600 transition-colors"
              >
                Go Home
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Get the last assistant message to display sources from
  const lastAssistantMessage = [...session.messages].reverse().find(m => m.role === 'assistant');
  const sources = lastAssistantMessage?.sources || [];
  const images = lastAssistantMessage?.highlighted_images || [];

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 relative z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 min-w-0">
              <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0">
                <Home className="w-6 h-6" />
              </Link>
              <div className="flex items-center flex-shrink-0">
                <span className="text-2xl font-bold text-white">deep</span>
                <span className="text-2xl font-bold text-blue-400">rxiv</span>
              </div>
              <div className="h-6 w-px bg-gray-600 flex-shrink-0"></div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-white truncate" title={session.title}>
                  {session.title}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  {session.arxiv_id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/50 text-blue-300">
                      {session.arxiv_id}
                    </span>
                  )}
                  <span>•</span>
                  <span>Shared conversation</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSourcesSidebarOpen(!sourcesSidebarOpen)}
                className="p-2 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition-colors"
                title={sourcesSidebarOpen ? "Hide sources" : "Show sources"}
              >
                <Database className="w-5 h-5" />
              </button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyShareLink}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all ${
                  copySuccess 
                    ? 'bg-green-900/30 border-green-700 text-green-400' 
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
                title="Copy share link"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Share</span>
                  </>
                )}
              </motion.button>
              
              <Link
                href="/chat"
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">New Chat</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-900" style={{ marginRight: sourcesSidebarOpen ? '384px' : '0' }}>
            <div className="max-w-4xl mx-auto px-4 py-4 bg-gray-900">
              {session.messages.length > 0 ? (
                <div className="space-y-6">
                  {session.messages.map((msg, index) => (
                    <div key={index} className="space-y-3">
                      {/* Chain of Thought - Show at TOP for assistant messages */}
                      {msg.role === 'assistant' && msg.chain_of_thought && (
                        <ChainOfThought thinking={msg.chain_of_thought} />
                      )}
                    
                      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-3xl ${
                          msg.role === 'user'
                            ? 'bg-gray-700 text-white px-4 py-3 rounded-2xl'
                            : 'text-white px-4 py-3 rounded-2xl'
                        }`}>
                          {msg.role === 'assistant' && msg.model_used && (
                            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                              <span className="capitalize">{msg.model_used.replace('-', ' ')}</span>
                            </div>
                          )}
                          
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            className={`prose ${msg.role === 'user' ? 'prose-invert' : 'prose-gray prose-invert'} max-w-none`}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          
                          {/* Sources and Citations - Enhanced display */}
                          {msg.role === 'assistant' && (
                            (msg.sources?.length ?? 0) > 0 || 
                            (msg.citations?.length ?? 0) > 0 || 
                            (msg.images?.length ?? 0) > 0 || 
                            (msg.highlighted_images?.length ?? 0) > 0
                          ) && (
                            <button
                              onClick={() => {
                                setCurrentSources({
                                  sources: msg.sources || [],
                                  citations: msg.citations || [],
                                  images: msg.images || [],
                                  highlighted_images: msg.highlighted_images || []
                                });
                                setSourcesSidebarOpen(true);
                              }}
                              className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View {(msg.sources?.length || 0)} RAG sources
                              {msg.citations && msg.citations.length > 0 && `, ${msg.citations.length} web citations`}
                              {msg.images && msg.images.length > 0 && `, ${msg.images.length} images`}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No messages yet</h3>
                  <p className="text-gray-400">This shared conversation doesn't have any messages.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer with input box mockup for design consistency */}
          <div className="p-4 bg-gray-900" style={{ marginRight: sourcesSidebarOpen ? '384px' : '0' }}>
            <div className="max-w-4xl mx-auto">
              <div className="bg-gray-800 rounded-2xl p-4 shadow-lg text-center">
                <p className="text-gray-400 mb-2">This is a shared conversation. Want to start your own?</p>
                <Link
                  href="/chat"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Start New Chat
                </Link>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar - Sources and Images */}
        <ChatSidebar
          sources={currentSources.sources}
          citations={currentSources.citations || []}
          images={currentSources.images || []}
          highlighted_images={currentSources.highlighted_images || []}
          isOpen={sourcesSidebarOpen}
          onClose={() => setSourcesSidebarOpen(false)}
        />
      </div>
    </div>
  );
} 