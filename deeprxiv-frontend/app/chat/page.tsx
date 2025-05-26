'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  MoreHorizontal, 
  Send, 
  ThumbsUp, 
  ThumbsDown, 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  Home,
  MessageCircle,
  User,
  Settings,
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
  thumbs_up?: boolean;
  thumbs_down?: boolean;
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

interface Paper {
  id: number;
  arxiv_id: string;
  title: string;
  authors?: string;
  processed: boolean;
}

const BACKEND_URL = 'http://localhost:8000';

export default function ChatPage() {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [papersLoading, setPapersLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [contentChunks, setContentChunks] = useState(3);
  const [sectionChunks, setSectionChunks] = useState(3);
  const [searchMode, setSearchMode] = useState('Raw');
  const [topN, setTopN] = useState(5);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load papers and sessions on mount
  useEffect(() => {
    loadPapers();
    loadSessions();
  }, []);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const loadPapers = async () => {
    try {
      setPapersLoading(true);
      console.log('Loading papers from:', `${BACKEND_URL}/api/papers`);
      const response = await fetch(`${BACKEND_URL}/api/papers`);
      if (response.ok) {
        const data = await response.json();
        console.log('Raw papers data:', data);
        const processedPapers = data.filter((p: Paper) => p.processed);
        console.log('Processed papers:', processedPapers);
        console.log('Papers with IDs:', processedPapers.map(p => ({ id: p.id, title: p.title, arxiv_id: p.arxiv_id })));
        setPapers(processedPapers);
      } else {
        console.error('Failed to load papers:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading papers:', error);
    } finally {
      setPapersLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/sessions?include_public=true`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createNewChat = async () => {
    try {
      console.log('Creating new chat with paper:', selectedPaper);
      const chatData = {
        paper_id: selectedPaper?.id,
        arxiv_id: selectedPaper?.arxiv_id,
        title: selectedPaper ? `Chat: ${selectedPaper.title}` : 'General Research Chat',
        is_public: true
      };
      console.log('Chat creation payload:', chatData);

      const response = await fetch(`${BACKEND_URL}/api/chat/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatData)
      });

      if (response.ok) {
        const session = await response.json();
        console.log('Chat session created:', session);
        setCurrentSession(session);
        loadSessions(); // Refresh sessions list
      } else {
        console.error('Failed to create chat:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentSession || loading) return;

    setLoading(true);
    const userMessage = message;
    setMessage('');

    // Immediately add user message to UI
    const tempUserMessage = {
      id: Date.now(), // Temporary ID
      role: 'user' as const,
      content: userMessage,
      created_at: new Date().toISOString()
    };

    setCurrentSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...prev.messages, tempUserMessage]
      };
    });

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.session_id,
          message: userMessage,
          content_chunks: contentChunks,
          section_chunks: sectionChunks
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Replace temporary user message with real one and add assistant message
        setCurrentSession(prev => {
          if (!prev) return null;
          
          // Remove the temporary message and add both real messages
          const messagesWithoutTemp = prev.messages.slice(0, -1);
          return {
            ...prev,
            messages: [
              ...messagesWithoutTemp,
              data.user_message,
              data.assistant_message
            ]
          };
        });
      } else {
        // Remove temporary message and show error
        setCurrentSession(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.slice(0, -1)
          };
        });
        console.error('Failed to send message:', response.status, response.statusText);
      }
    } catch (error) {
      // Remove temporary message on error
      setCurrentSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.slice(0, -1)
        };
      });
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (messageId: number, thumbsUp?: boolean, thumbsDown?: boolean) => {
    try {
      await fetch(`${BACKEND_URL}/api/chat/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          thumbs_up: thumbsUp,
          thumbs_down: thumbsDown
        })
      });

      // Update local state
      setCurrentSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === messageId 
              ? { ...msg, thumbs_up: thumbsUp, thumbs_down: thumbsDown }
              : msg
          )
        };
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/${sessionId}`);
      if (response.ok) {
        const session = await response.json();
        setCurrentSession(session);
        
        // Set selected paper if session has one, otherwise keep current selection
        if (session.paper_id) {
          const paper = papers.find(p => p.id === session.paper_id);
          if (paper) {
            setSelectedPaper(paper);
          }
        } else {
          // Only clear selection if this session truly has no paper
          setSelectedPaper(null);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const shareSession = async () => {
    if (!currentSession?.share_url) return;
    
    const shareUrl = `${window.location.origin}/chat/share/${currentSession.share_url}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

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
              <h2 className="text-lg font-semibold text-slate-700 truncate max-w-xl" title={currentSession?.title || (selectedPaper ? `Chat: ${selectedPaper.title}` : 'New Chat')}>
                {currentSession?.title || (selectedPaper ? `Chat: ${selectedPaper.title}` : 'New Chat')}
              </h2>
              {(currentSession?.paper_title || selectedPaper) && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Paper: {currentSession?.paper_title || selectedPaper?.title}
                  {(currentSession?.arxiv_id || selectedPaper?.arxiv_id) && (
                    <span className="ml-2 text-slate-400">
                      ({currentSession?.arxiv_id || selectedPaper?.arxiv_id})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentSession?.is_public && (
              <button
                onClick={shareSession}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <aside className="w-72 bg-slate-50 p-6 flex flex-col border-r border-slate-200">
          {/* Paper Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Paper (Optional)
            </label>

            <select
              value={selectedPaper?.id || ''}
              onChange={(e) => {
                const value = e.target.value;
                console.log('Dropdown value changed to:', value);
                console.log('Available papers:', papers);
                
                if (value === '') {
                  console.log('Setting selectedPaper to null');
                  setSelectedPaper(null);
                } else {
                  const paperId = parseInt(value);
                  console.log('Looking for paper with ID:', paperId);
                  const paper = papers.find(p => p.id === paperId);
                  console.log('Found paper:', paper);
                  setSelectedPaper(paper || null);
                }
              }}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              disabled={papersLoading}
            >
              <option key="general" value="">
                {papersLoading ? 'Loading papers...' : 'General Chat (No Paper Selected)'}
              </option>
              {papers.map((paper, index) => (
                <option key={`paper-${paper.id || index}`} value={paper.id}>
                  {paper.title}
                </option>
              ))}
            </select>
            {selectedPaper && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                <p className="text-xs text-green-700 font-medium">
                  ✓ Selected Paper:
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {selectedPaper.title}
                </p>
                <p className="text-xs text-green-500 mt-1">
                  arXiv ID: {selectedPaper.arxiv_id}
                </p>
              </div>
            )}
            {papers.length === 0 && !papersLoading && (
              <p className="text-xs text-amber-600 mt-1">
                No processed papers available. Process some papers first.
              </p>
            )}
          </div>

          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors mb-6 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {selectedPaper ? `Start Chat about Selected Paper` : 'New General Chat'}
          </button>

          {/* Chat Sessions */}
          <nav className="flex-grow space-y-1 overflow-y-auto -mr-3 pr-3">
            {sessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => loadSession(session.session_id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-left ${
                  currentSession?.session_id === session.session_id
                    ? 'bg-slate-200 font-medium text-slate-700'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="truncate flex-1">
                  <div className="truncate text-slate-900">{session.title}</div>
                  {session.arxiv_id && (
                    <div className="text-xs text-slate-500 truncate">
                      {session.arxiv_id}
                    </div>
                  )}
                </div>
                <MoreHorizontal className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            ))}
          </nav>

          {/* Bottom Navigation */}
          <div className="mt-auto pt-4">
            <div className="border-t border-slate-200 pt-2">
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors text-sm">
                <User className="w-4 h-4 text-slate-500" />
                <span className="truncate">User Profile</span>
              </Link>
              <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors text-sm">
                <Settings className="w-4 h-4 text-slate-500" />
                <span className="truncate">Settings</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col max-h-[calc(100vh-4rem)] overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
            {currentSession && currentSession.messages.length > 0 ? (
              <>
                {currentSession.messages.map((msg, index) => (
                  <div key={msg.id || index} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
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
                          
                          {/* Feedback Buttons */}
                          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-200">
                            <button
                              onClick={() => submitFeedback(msg.id, !msg.thumbs_up, false)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                msg.thumbs_up ? 'bg-green-100 text-green-700' : 'text-slate-600 hover:text-green-600'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              {msg.thumbs_up ? 'Liked' : 'Like'}
                            </button>
                            <button
                              onClick={() => submitFeedback(msg.id, false, !msg.thumbs_down)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                msg.thumbs_down ? 'bg-red-100 text-red-700' : 'text-slate-600 hover:text-red-600'
                              }`}
                            >
                              <ThumbsDown className="w-3 h-3" />
                              {msg.thumbs_down ? 'Disliked' : 'Dislike'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="text-left">
                    <div className="inline-block bg-slate-100 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="text-slate-600">
                          {selectedPaper ? `Analyzing "${selectedPaper.title.substring(0, 30)}..."` : 'Generating response...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  {selectedPaper ? `Chat about: ${selectedPaper.title}` : 'Start a new conversation'}
                </h3>
                <p className="text-slate-600 mb-2">
                  {selectedPaper 
                    ? 'Ask questions about this paper and get insights from its content.'
                    : 'Select a paper or start a general research conversation.'
                  }
                </p>
                {selectedPaper && (
                  <div className="inline-block bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                    <p className="text-xs text-blue-700 font-medium">
                      Selected Paper: {selectedPaper.arxiv_id}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {selectedPaper.authors || 'Authors not available'}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-slate-50 border-t border-slate-200 p-6">
            <div className="max-w-3xl mx-auto">
              {/* Settings Row */}
              <div className="space-y-3 mb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <select
                        value={searchMode}
                        onChange={(e) => setSearchMode(e.target.value)}
                        className="appearance-none bg-slate-100 border border-slate-300 text-slate-700 text-sm rounded-md py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option key="raw" value="Raw">Raw</option>
                        <option key="enhanced" value="Enhanced">Enhanced</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs text-slate-500">Content:</span>
                      <input
                        type="number"
                        value={contentChunks}
                        onChange={(e) => setContentChunks(parseInt(e.target.value) || 3)}
                        className="text-xs w-12 border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1 text-center"
                        min="1"
                        max="10"
                      />
                      <span className="text-xs text-slate-500">Sections:</span>
                      <input
                        type="number"
                        value={sectionChunks}
                        onChange={(e) => setSectionChunks(parseInt(e.target.value) || 3)}
                        className="text-xs w-12 border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1 text-center"
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Input */}
              <div className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={selectedPaper 
                    ? `Ask a question about "${selectedPaper.title}" or request a summary...`
                    : "Ask a general research question or select a paper above..."
                  }
                  className="w-full p-4 pr-16 text-sm text-slate-700 placeholder-slate-400 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !message.trim() || !currentSession}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-full p-2.5 hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar - Sources and Images */}
        {currentSession && currentSession.messages.length > 0 && (
          <aside className="w-80 bg-slate-50 p-6 border-l border-slate-200 flex flex-col max-h-[calc(100vh-4rem)]">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Source Information</h3>
            
            {/* Get sources from latest assistant message */}
            {(() => {
              const lastAssistantMessage = [...currentSession.messages].reverse().find(m => m.role === 'assistant');
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
                          <div key={image.id || index} className="aspect-w-3 aspect-h-4 bg-slate-200 rounded-md overflow-hidden">
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
                  {currentSession.arxiv_id && (
                    <button
                      onClick={() => window.open(`https://arxiv.org/pdf/${currentSession.arxiv_id}.pdf`, '_blank')}
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
                            <div key={source.index || index} className="text-xs">
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
              <Link href={currentSession.arxiv_id ? `/abs/${currentSession.arxiv_id}` : '/papers'} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span>Back to {currentSession.arxiv_id ? 'Paper' : 'Papers'}</span>
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
} 