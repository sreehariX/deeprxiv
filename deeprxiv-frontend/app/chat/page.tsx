'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  Plus, 
  MoreHorizontal, 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  MessageCircle,
  Database,
  Sidebar,
  X,
  Brain,
  Zap,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Trash2,
  Edit3,
  Share2,
  User
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'motion/react';
import ModelSelector from '@/components/ModelSelector';
import ChainOfThought from '@/components/ChainOfThought';
import ChatSidebar from '@/components/ChatSidebar';
import { useAuthStore } from '@/utils/auth-store';

const BACKEND_URL = 'http://localhost:8000';

// Types
interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  chain_of_thought?: string;
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
  model_used?: string;
  thumbs_up?: boolean;
  thumbs_down?: boolean;
  created_at: string;
  isStreaming?: boolean;
  query_mode?: 'enhanced' | 'raw';
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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('sonar');
  const [queryMode, setQueryMode] = useState<'enhanced' | 'raw'>('enhanced');
  const [queryModeDropdownOpen, setQueryModeDropdownOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sourcesSidebarOpen, setSourcesSidebarOpen] = useState(true);
  const [currentSources, setCurrentSources] = useState<any>({});
  const [contentChunks, setContentChunks] = useState(3);
  const [sectionChunks, setSectionChunks] = useState(3);
  const [paperDropdownOpen, setPaperDropdownOpen] = useState(false);
  const [shareToast, setShareToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [hasInitialized, setHasInitialized] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const paperDropdownRef = useRef<HTMLDivElement>(null);
  const queryModeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPapers();
    loadSessions();
    
    // Handle URL parameters for auto-selecting paper or loading session
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    const arxivIdParam = urlParams.get('arxiv_id');
    const paperIdParam = urlParams.get('paper_id');
    
    if (sessionParam) {
      // Load specific session
      loadSession(sessionParam);
    } else if (arxivIdParam || paperIdParam) {
      // Auto-select paper and create new chat with direct arxiv_id/paper_id
      setTimeout(() => {
        if (paperIdParam) {
          const paper = papers.find(p => p.id === parseInt(paperIdParam));
          if (paper) {
            setSelectedPaper(paper);
            createNewChatWithPaper(paper);
          }
        } else if (arxivIdParam) {
          const paper = papers.find(p => p.arxiv_id === arxivIdParam);
          if (paper) {
            setSelectedPaper(paper);
            createNewChatWithPaper(paper);
          } else {
            // If paper not found in local list, try creating chat with arxiv_id directly
            createNewChatWithArxivId(arxivIdParam);
          }
        }
      }, 1000); // Wait for papers to load
    }
  }, []);

  // Auto-load latest session when sessions are loaded (if no specific URL params)
  useEffect(() => {
    if (hasInitialized) return; // Prevent multiple initializations
    
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    const arxivIdParam = urlParams.get('arxiv_id');
    const paperIdParam = urlParams.get('paper_id');
    
    // Only auto-load if no URL params and no current session
    if (!sessionParam && !arxivIdParam && !paperIdParam && !currentSession && sessions.length > 0) {
      // Load the most recent session (sessions are ordered by updated_at desc from backend)
      const latestSession = sessions[0];
      loadSession(latestSession.session_id);
      setHasInitialized(true);
    } else if (!sessionParam && !arxivIdParam && !paperIdParam && sessions.length === 0) {
      // If no sessions exist and no URL params, show paper selection screen
      setHasInitialized(true);
    }
  }, [sessions, currentSession, hasInitialized]);

  useEffect(() => {
    // Handle paper selection from URL params after papers are loaded
    const urlParams = new URLSearchParams(window.location.search);
    const arxivIdParam = urlParams.get('arxiv_id');
    const paperIdParam = urlParams.get('paper_id');
    
    if (papers.length > 0 && (arxivIdParam || paperIdParam)) {
      if (paperIdParam) {
        const paper = papers.find(p => p.id === parseInt(paperIdParam));
        if (paper && !selectedPaper) {
          setSelectedPaper(paper);
          if (!currentSession) {
            createNewChatWithPaper(paper);
          }
        }
      } else if (arxivIdParam) {
        const paper = papers.find(p => p.arxiv_id === arxivIdParam);
        if (paper && !selectedPaper) {
          setSelectedPaper(paper);
          if (!currentSession) {
            createNewChatWithPaper(paper);
          }
        } else if (!selectedPaper && !currentSession) {
          // If paper not found in local list, try creating chat with arxiv_id directly
          createNewChatWithArxivId(arxivIdParam);
        }
      }
    }
  }, [papers]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputMessage]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paperDropdownRef.current && !paperDropdownRef.current.contains(event.target as Node)) {
        setPaperDropdownOpen(false);
      }
      if (queryModeDropdownRef.current && !queryModeDropdownRef.current.contains(event.target as Node)) {
        setQueryModeDropdownOpen(false);
      }
    };

    if (paperDropdownOpen || queryModeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [paperDropdownOpen, queryModeDropdownOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadPapers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/papers`);
      if (response.ok) {
        const data = await response.json();
        setPapers(data.filter((paper: Paper) => paper.processed));
      }
    } catch (error) {
      console.error('Error loading papers:', error);
    }
  };

  const loadSessions = async () => {
    try {
      // Load user's sessions if authenticated, otherwise load public sessions
      const endpoint = isAuthenticated && user 
        ? `${BACKEND_URL}/api/chat/sessions?user_id=${user.id}&include_public=true`
        : `${BACKEND_URL}/api/chat/sessions?include_public=true`;
        
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        
        // Sort sessions to put the user's own sessions first
        if (isAuthenticated && user) {
          data.sort((a: any, b: any) => {
            // User's sessions first, then most recently updated
            if (a.user_id === user.id && b.user_id !== user.id) return -1;
            if (a.user_id !== user.id && b.user_id === user.id) return 1;
            // If both are user's or both are not, sort by date
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });
        }
        
        setSessions(data);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Chat',
          paper_id: selectedPaper?.id || null,
          is_public: true,
          user_id: user?.id || null
        })
      });

      if (response.ok) {
        const session = await response.json();
        setCurrentSession(session);
        setMessages([]);
        
        // Ensure paper is linked to session
        if (selectedPaper && !session.paper_id) {
          console.warn('Paper was selected but not linked to session:', selectedPaper);
        }
        
        // Make sure to add the new session to the sidebar immediately
        setSessions(prevSessions => [session, ...prevSessions]);
        
        // Also reload all sessions to ensure everything is in sync
        setTimeout(() => {
          loadSessions();
        }, 500);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  // Helper function to create new chat with a specific paper
  const createNewChatWithPaper = async (paper: Paper) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Chat about ${paper.arxiv_id}`,
          paper_id: paper.id,
          is_public: true,
          user_id: user?.id || null
        })
      });

      if (response.ok) {
        const session = await response.json();
        setCurrentSession(session);
        setMessages([]);
        
        // Make sure to add the new session to the sidebar immediately
        setSessions(prevSessions => [session, ...prevSessions]);
        
        // Also reload all sessions to ensure everything is in sync
        setTimeout(() => {
          loadSessions();
        }, 500);
      }
    } catch (error) {
      console.error('Error creating chat with paper:', error);
    }
  };

  const createNewChatWithArxivId = async (arxivId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Chat about ${arxivId}`,
          arxiv_id: arxivId,
          is_public: true,
          user_id: user?.id || null
        })
      });

      if (response.ok) {
        const session = await response.json();
        setCurrentSession(session);
        setMessages([]);
        
        // Set selectedPaper from session response if available
        if (session.paper_id && session.arxiv_id) {
          const paperFromSession = {
            id: session.paper_id,
            arxiv_id: session.arxiv_id,
            title: session.paper_title || session.arxiv_id,
            authors: '',
            processed: true
          };
          setSelectedPaper(paperFromSession);
          console.log('Set selected paper from session:', paperFromSession);
        }
        
        // Make sure to add the new session to the sidebar immediately
        setSessions(prevSessions => [session, ...prevSessions]);
        
        // Also reload all sessions to ensure everything is in sync
        setTimeout(() => {
          loadSessions();
        }, 500);
      }
    } catch (error) {
      console.error('Error creating chat with arxiv_id:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/${sessionId}`);
      if (response.ok) {
        const session = await response.json();
        console.log('Loaded session:', session);
        setCurrentSession(session);
        setMessages(session.messages || []);
        
        // Restore sources from the latest assistant message
        if (session.messages && session.messages.length > 0) {
          const lastAssistantMessage = [...session.messages].reverse().find(m => m.role === 'assistant');
          if (lastAssistantMessage) {
            const sourcesData = {
              sources: lastAssistantMessage.sources || [],
              citations: lastAssistantMessage.citations || [],
              images: lastAssistantMessage.images || [],
              highlighted_images: lastAssistantMessage.highlighted_images || []
            };
            console.log('Setting sources from session:', sourcesData);
            setCurrentSources(sourcesData);
          }
        } else {
          // Try to restore from localStorage if no messages in session
          try {
            const savedSources = localStorage.getItem('deeprxiv_current_sources');
            if (savedSources) {
              const sourcesData = JSON.parse(savedSources);
              console.log('Restoring sources from localStorage:', sourcesData);
              setCurrentSources(sourcesData);
            }
          } catch (e) {
            console.error('Error restoring sources from localStorage:', e);
          }
        }
        
        // Set selected paper if session has one
        if (session.paper_id && papers.length > 0) {
          const paper = papers.find(p => p.id === session.paper_id);
          if (paper) {
            console.log('Setting selected paper from session:', paper);
            setSelectedPaper(paper);
          } else {
            console.warn('Paper not found for session paper_id:', session.paper_id);
          }
        } else if (session.paper_id) {
          console.warn('Session has paper_id but papers not loaded yet:', session.paper_id);
        } else {
          console.log('Session has no paper_id, clearing selected paper');
          // Don't clear selected paper if no paper_id - user might have manually selected one
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const deleteSessionFromSidebar = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      // Only remove from local sessions list, don't delete from database
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        
      // If this was the current session, clear it
        if (currentSession?.session_id === sessionId) {
          setCurrentSession(null);
          setMessages([]);
      }
    } catch (error) {
      console.error('Error removing session from sidebar:', error);
    }
  };

  const shareChat = async () => {
    if (!currentSession) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/${currentSession.session_id}/share`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}/chat/share/${data.share_url}`;
        
          await navigator.clipboard.writeText(shareUrl);
          
          setShareToast({
            show: true,
          message: `Share link copied! ${shareUrl}`,
            type: 'success'
          });
          
          setTimeout(() => {
            setShareToast(prev => ({ ...prev, show: false }));
        }, 5000);
      } else {
        throw new Error('Failed to create share link');
      }
    } catch (error) {
      console.error('Error sharing chat:', error);
      setShareToast({
        show: true,
        message: 'Failed to share chat. Please try again.',
        type: 'error'
      });
      
      setTimeout(() => {
        setShareToast(prev => ({ ...prev, show: false }));
      }, 3000);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !currentSession || isLoading) return;
    
    // Debug logging
    console.log('sendMessage called:', {
      inputMessage: inputMessage.trim(),
      currentSession: currentSession?.session_id,
      isLoading,
      selectedPaper: selectedPaper?.id,
      selectedPaperArxiv: selectedPaper?.arxiv_id,
      sessionPaperId: currentSession?.paper_id,
      sessionArxivId: currentSession?.arxiv_id
    });
    
    // Enforce paper selection for RAG (allow if selectedPaper is set OR session has paper_id)
    if (!selectedPaper && !currentSession?.paper_id) {
      console.log('No paper selected and session has no paper_id, showing error message');
      setShareToast({
        show: true,
        message: 'Please select a paper first',
        type: 'error'
      });
      
      setTimeout(() => {
        setShareToast(prev => ({ ...prev, show: false }));
      }, 3000);
      return;
    }

    console.log('Paper available for RAG:', selectedPaper || { 
      id: currentSession?.paper_id, 
      arxiv_id: currentSession?.arxiv_id,
      title: currentSession?.paper_title 
    });

    // Update session title immediately if this is the first message
    if (messages.length === 0 && (currentSession.title === 'New Chat' || !currentSession.title)) {
      const arxivId = selectedPaper?.arxiv_id || currentSession?.arxiv_id || 'Unknown';
      const newTitle = `${arxivId}: ${inputMessage.slice(0, 50)}${inputMessage.length > 50 ? '...' : ''}`;
      setCurrentSession(prev => prev ? { ...prev, title: newTitle } : null);
      
      // Update sessions list as well
      setSessions(prev => prev.map(session => 
        session.session_id === currentSession.session_id 
          ? { ...session, title: newTitle }
          : session
      ));
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      created_at: new Date().toISOString(),
      query_mode: queryMode
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
        await handleStreamingResponse(inputMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamingResponse = async (message: string) => {
    const response = await fetch(`${BACKEND_URL}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSession!.session_id,
        message,
        model: selectedModel,
        stream: true,
        content_chunks: contentChunks,
        section_chunks: sectionChunks,
        query_mode: queryMode,
        return_images: true
      })
    });

    if (!response.ok) throw new Error('Failed to send message');

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let assistantMessage: ChatMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true,
      model_used: selectedModel,
      query_mode: queryMode
    };

    setMessages(prev => [...prev, assistantMessage]);

    const decoder = new TextDecoder();
    let buffer = '';
    let cotContent = '';
    let responseContent = '';
    let isCoTSection = true;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                const content = data.content;
                
                // For reasoning models, detect CoT vs response
                if (selectedModel.includes('reasoning')) {
                  if (content.includes('\n') && isCoTSection) {
                    // Transition from CoT to response
                    isCoTSection = false;
                    cotContent += content.split('\n')[0];
                    responseContent += content.split('\n').slice(1).join('\n');
                  } else if (isCoTSection) {
                    cotContent += content;
                  } else {
                    responseContent += content;
                  }
                  
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                      ? { 
                          ...msg, 
                          content: responseContent,
                          chain_of_thought: cotContent
                        }
                    : msg
                ));
                } else {
                  // Non-reasoning models - just stream content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: msg.content + content }
                      : msg
                  ));
                }
              } else if (data.type === 'metadata') {
                console.log('Received metadata:', data);
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { 
                        ...msg, 
                        isStreaming: false,
                        // For reasoning models, prioritize the chain_of_thought from streaming content over metadata
                        chain_of_thought: selectedModel.includes('reasoning') && cotContent 
                          ? cotContent 
                          : (data.chain_of_thought || ''),
                        citations: data.citations,
                        images: data.images,
                        sources: data.sources
                      }
                    : msg
                ));
                
                // Update sources sidebar
                const sidebarData = {
                  sources: data.sources || [],
                  citations: data.citations || [],
                  images: data.images || [],
                  highlighted_images: data.highlighted_images || []
                };
                console.log('Setting sidebar data from metadata:', sidebarData);
                setCurrentSources(sidebarData);
              } else if (data.type === 'done') {
                break;
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getModelIcon = (model: string) => {
    switch (model) {
      case 'sonar': return <Search className="w-3 h-3" />;
      case 'sonar-pro': return <Sparkles className="w-3 h-3" />;
      case 'sonar-reasoning': return <Brain className="w-3 h-3" />;
      case 'sonar-reasoning-pro': return <Zap className="w-3 h-3" />;
      default: return <Search className="w-3 h-3" />;
    }
  };

  const getQueryModeIcon = (mode: 'enhanced' | 'raw') => {
    return mode === 'enhanced' ? <Sparkles className="w-3 h-3" /> : <Search className="w-3 h-3" />;
  };

  const getQueryModeDescription = (mode: 'enhanced' | 'raw') => {
    return mode === 'enhanced' 
      ? 'Query enhanced for better vector search, then answered with original query'
      : 'Direct vector search with original query';
  };

  // When papers are loaded, check if current session needs a paper set
  useEffect(() => {
    if (currentSession && currentSession.paper_id && papers.length > 0 && !selectedPaper) {
      const paper = papers.find(p => p.id === currentSession.paper_id);
      if (paper) {
        console.log('Setting paper after papers loaded:', paper);
        setSelectedPaper(paper);
      }
    }
  }, [papers, currentSession, selectedPaper]);

  // Add this in useEffect that handles message updates
  useEffect(() => {
    scrollToBottom();
    
    // Always update sources from the latest assistant message
    if (messages.length > 0) {
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMessage) {
        const sourcesData = {
          sources: lastAssistantMessage.sources || [],
          citations: lastAssistantMessage.citations || [],
          images: lastAssistantMessage.images || [],
          highlighted_images: lastAssistantMessage.highlighted_images || []
        };
        console.log('Updating sources from latest message:', sourcesData);
        setCurrentSources(sourcesData);
        localStorage.setItem('deeprxiv_current_sources', JSON.stringify(sourcesData));
      } else {
        // No assistant messages, clear sources
        setCurrentSources({ sources: [], citations: [], images: [], highlighted_images: [] });
      }
    } else {
      // No messages, clear sources
      setCurrentSources({ sources: [], citations: [], images: [], highlighted_images: [] });
    }
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Left Sidebar - Darker */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3 
            }}
            className="w-80 bg-gray-950 flex flex-col rounded-r-2xl shadow-2xl overflow-hidden"
            style={{ height: '100vh', position: 'fixed', left: 0, top: '0', zIndex: 50 }}
          >
            <div className="p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">DeepRxiv</h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <button
                onClick={createNewChat}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {/* Chat Sessions - Scrollable */}
            <div className="flex-1 px-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Chats</h3>
              <div className="space-y-1 pb-4">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className={`group relative rounded-lg transition-colors ${
                      currentSession?.id === session.id
                        ? 'bg-gray-800'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <button
                      onClick={() => loadSession(session.session_id)}
                      className="w-full text-left p-3 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">
                          {session.title && session.title !== 'New Chat' ? session.title : (session.arxiv_id ? `Chat about ${session.arxiv_id}` : 'New Chat')}
                        </span>
                      </div>
                      {session.paper_title && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-400 truncate">
                            📄 {session.paper_title}
                          </p>
                        </div>
                      )}
                    </button>
                    
                    {/* Delete button - only visible on hover */}
                    <button
                      onClick={(e) => deleteSessionFromSidebar(session.session_id, e)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded-full transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900 min-h-0" style={{ marginLeft: sidebarOpen ? '320px' : '0' }}>
        {/* Header */}
        <div className="bg-gray-900 px-4 py-3 flex-shrink-0 fixed top-0 left-0 right-0 z-50" 
             style={{ marginLeft: sidebarOpen ? '320px' : '0' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <Sidebar className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold text-white">
                {selectedPaper ? selectedPaper.title : 'DeepRxiv'}
              </h1>
          </div>
            
            <div className="flex items-center gap-3">
              {currentSession && (
                <button
                  onClick={shareChat}
                  className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                  title="Share chat"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setSourcesSidebarOpen(!sourcesSidebarOpen)}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                title={sourcesSidebarOpen ? "Hide sources" : "Show sources"}
              >
                <Database className="w-5 h-5" />
              </button>
              
              {/* User Profile Picture */}
              {isAuthenticated && user ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center cursor-pointer">
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name || user.email} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center cursor-pointer">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages - Fixed height container with top margin for header */}
        <div 
          className="flex-1 bg-gray-900 overflow-y-auto" 
          style={{ 
            marginRight: sourcesSidebarOpen ? '384px' : '0',
            marginTop: '72px', // Space for chat header only (no navigation)
            height: 'calc(100vh - 222px)',  // Adjusted height for chat header and input area only
            backgroundColor: '#111827' // Ensure gray-900 background
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-4 pb-16">
            {messages.length > 0 && (
              <div className="space-y-6">
              {messages.map((message) => (
                  <div key={message.id} className="space-y-3" data-message-id={message.id}>
                    {/* Chain of Thought - Show at TOP for assistant messages */}
                    {message.role === 'assistant' && message.chain_of_thought && (
                      <ChainOfThought thinking={message.chain_of_thought} />
                    )}
                    
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-3xl ${
                      message.role === 'user'
                        ? 'bg-gray-700 text-white px-4 py-3 rounded-2xl'
                        : 'text-white px-4 py-3 rounded-2xl'
                    }`}>
                      {message.role === 'assistant' && message.model_used && (
                        <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                          {getModelIcon(message.model_used)}
                          <span className="capitalize">{message.model_used.replace('-', ' ')}</span>
                            {message.query_mode && (
                              <>
                                <span>•</span>
                                {getQueryModeIcon(message.query_mode)}
                                <span className="capitalize">{message.query_mode}</span>
                              </>
                            )}
                          {message.isStreaming && <span className="animate-pulse">●</span>}
          </div>
                        )}
                        
                        {message.role === 'user' && message.query_mode && (
                          <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                            {getQueryModeIcon(message.query_mode)}
                            <span className="capitalize">{message.query_mode} Mode</span>
                          </div>
                      )}
                      
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            className={`prose ${message.role === 'user' ? 'prose-invert' : 'prose-gray prose-invert'} max-w-none latex-container`}
                          components={{
                            // Enhanced LaTeX rendering with proper display handling
                            div: ({ node, className, children, ...props }) => {
                              // Handle KaTeX display blocks
                              if (className?.includes('katex-display')) {
                                return (
                                  <div className="katex-display-wrapper my-4 text-center overflow-x-auto" {...props}>
                                    <div className="inline-block">{children}</div>
                                  </div>
                                );
                              }
                              return <div className={className} {...props}>{children}</div>;
                            },
                            // Better paragraph handling for math content
                            p: ({ node, children, ...props }) => {
                              // Check if paragraph contains only math content
                              const hasOnlyMath = node?.children?.every((child: any) => 
                                child.type === 'element' && 
                                (child.tagName === 'span' || child.tagName === 'div') &&
                                child.properties?.className?.includes('katex')
                              );
                              
                              if (hasOnlyMath) {
                                return <div className="math-paragraph my-4 text-center" {...props}>{children}</div>;
                              }
                              
                              return <p className="mb-4 leading-relaxed" {...props}>{children}</p>;
                            },
                            // Enhanced code handling
                            code: ({ node, className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const isInline = !match;
                              
                              if (isInline) {
                                return (
                                  <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-100 font-mono text-sm" {...props}>
                                    {children}
                                  </code>
                                );
                              }
                              
                              return (
                                <div className="relative group my-4">
                                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                                    <code className="text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                </div>
                              );
                            },
                            // Better heading styling
                            h1: ({ children, ...props }) => <h1 className="text-xl font-bold my-4 text-white" {...props}>{children}</h1>,
                            h2: ({ children, ...props }) => <h2 className="text-lg font-semibold my-3 text-white" {...props}>{children}</h2>,
                            h3: ({ children, ...props }) => <h3 className="text-base font-medium my-2 text-white" {...props}>{children}</h3>,
                            // Enhanced list styling
                            ul: ({ children, ...props }) => <ul className="list-disc list-inside mb-4 text-gray-200 space-y-1" {...props}>{children}</ul>,
                            ol: ({ children, ...props }) => <ol className="list-decimal list-inside mb-4 text-gray-200 space-y-1" {...props}>{children}</ol>,
                            li: ({ children, ...props }) => <li className="mb-1" {...props}>{children}</li>,
                            // Better blockquote styling
                            blockquote: ({ children, ...props }) => (
                              <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 bg-gray-800/30 rounded-r text-gray-300 italic" {...props}>
                                {children}
                              </blockquote>
                            ),
                            // Enhanced link styling
                            a: ({ children, href, ...props }) => (
                              <a 
                                href={href}
                                className="text-blue-400 hover:text-blue-300 hover:underline"
                                target={href?.startsWith('http') ? '_blank' : undefined}
                                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                                {...props}
                              >
                                {children}
                              </a>
                            ),
                            // Better table styling
                            table: ({ children, ...props }) => (
                              <div className="overflow-x-auto my-4">
                                <table className="min-w-full divide-y divide-gray-700 border border-gray-700 rounded text-gray-200" {...props}>
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children, ...props }) => <thead className="bg-gray-800" {...props}>{children}</thead>,
                            th: ({ children, ...props }) => (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" {...props}>
                                {children}
                              </th>
                            ),
                            td: ({ children, ...props }) => (
                              <td className="px-4 py-3 text-sm border-t border-gray-700" {...props}>
                                {children}
                              </td>
                            ),
                            // Enhanced image handling
                            img: ({ src, alt, ...props }) => (
                              <div className="my-4 text-center">
                                <img
                                  src={src}
                                  alt={alt || 'Image'}
                                  className="mx-auto rounded-lg max-h-96 object-contain border border-gray-700"
                                  loading="lazy"
                                  {...props}
                                />
                                {alt && (
                                  <p className="text-center text-sm text-gray-400 mt-2">{alt}</p>
                                )}
                              </div>
                            ),
                          }}
                          >
                            {message.content}
                          </ReactMarkdown>
                          
                        {/* Sources and Citations - Enhanced display */}
                        {(message.sources && message.sources.length > 0) || 
                         (message.citations && message.citations.length > 0) || 
                         (message.images && message.images.length > 0) ? (
                            <button
                          onClick={() => {
                              const sourcesData = {
                              sources: message.sources || [],
                              citations: message.citations || [],
                                images: message.images || [],
                                highlighted_images: message.highlighted_images || []
                              };
                              console.log('Setting sources data:', sourcesData);
                              setCurrentSources(sourcesData);
                            setSourcesSidebarOpen(true);
                          }}
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                            View {(message.sources?.length || 0)} RAG sources
                            {message.citations && message.citations.length > 0 && `, ${message.citations.length} web citations`}
                            {message.images && message.images.length > 0 && `, ${message.images.length} images`}
                        </button>
                        ) : message.role === 'assistant' && selectedPaper && (
                          <p className="mt-2 text-xs text-gray-500 italic">
                            
                          </p>
                      )}
                      
                      {message.role === 'assistant' && !message.isStreaming && (
                        <div className="flex items-center gap-2 mt-3 pt-2">
                            <button className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                            <Copy className="w-4 h-4" />
                          </button>
                            <button className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                            <button className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                            <ThumbsDown className="w-4 h-4" />
                            </button>
                            <button className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                            <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                      )}
                    </div>
                  </div>
              </div>
              ))}
              </div>
            )}
            
            {!selectedPaper && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Select a Paper</h3>
                <p className="text-gray-400 text-sm">
                  Choose a paper from the dropdown above to start chatting
                </p>
              </div>
            )}
              
              {isLoading && (
              <div className="flex justify-start mt-4">
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      <span className="text-gray-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
              </div>

        {/* Input Area with Integrated Controls - Fixed positioning */}
        <div 
          className="bg-gray-900 p-4 flex-shrink-0 fixed bottom-0 left-0 right-0 z-10" 
          style={{ 
            marginLeft: sidebarOpen ? '320px' : '0',
            marginRight: sourcesSidebarOpen ? '384px' : '0'
          }}
        >
          <div className="max-w-4xl mx-auto w-full flex justify-center">
            {/* Enhanced Input Box with Integrated Controls */}
              <div className="relative">
                <div className="bg-gray-800 rounded-3xl p-1 shadow-lg ring-1 ring-gray-700">
                  <div className="bg-gray-700 rounded-3xl p-4">
                    {/* Top Controls Row */}
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Model:</span>
                        <ModelSelector
                          selectedModel={selectedModel}
                          onModelChange={setSelectedModel}
                          className="w-48"
                        />
          </div>
                    
                    {/* Query Mode Selection */}
                    <div className="flex items-center gap-2 relative" ref={queryModeDropdownRef}>
                      <span className="text-gray-400">Mode:</span>
                      <button
                        onClick={() => setQueryModeDropdownOpen(!queryModeDropdownOpen)}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-800 text-white rounded-full text-xs hover:bg-gray-700 transition-colors"
                        title={getQueryModeDescription(queryMode)}
                      >
                        {getQueryModeIcon(queryMode)}
                        <span className="capitalize">{queryMode}</span>
                        {queryModeDropdownOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      
                      {queryModeDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-1 w-80 bg-gray-800 rounded-lg shadow-lg z-50">
                          <button
                            onClick={() => {
                              setQueryMode('enhanced');
                              setQueryModeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-3 hover:bg-gray-700 transition-colors ${
                              queryMode === 'enhanced' ? 'bg-gray-700' : ''
                            } rounded-t-lg`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="w-4 h-4 text-blue-400" />
                              <span className="text-sm font-medium text-white">Enhanced</span>
                            </div>
                            <p className="text-xs text-gray-400">
                              Query enhanced for better vector search, then answered with original query using Sonar model
                            </p>
                          </button>
                          <button
                            onClick={() => {
                              setQueryMode('raw');
                              setQueryModeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-3 hover:bg-gray-700 transition-colors ${
                              queryMode === 'raw' ? 'bg-gray-700' : ''
                            } rounded-b-lg`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Search className="w-4 h-4 text-green-400" />
                              <span className="text-sm font-medium text-white">Raw</span>
                            </div>
                            <p className="text-xs text-gray-400">
                              Direct vector search with original query, response with chunks as context using selected model
                            </p>
                          </button>
                        </div>
                      )}
                    </div>
                      
                      {/* Paper Selection */}
                      <div className="flex items-center gap-2 relative" ref={paperDropdownRef}>
                        <span className="text-gray-400">Paper:</span>
                        <button
                          onClick={() => setPaperDropdownOpen(!paperDropdownOpen)}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-800 text-white rounded-full text-xs hover:bg-gray-700 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{selectedPaper ? selectedPaper.arxiv_id : 'Select Paper'}</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${paperDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {paperDropdownOpen && (
                          <div className="absolute bottom-full left-0 mb-1 w-80 bg-gray-800 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                            <button
                              onClick={() => {
                                setSelectedPaper(null);
                                setPaperDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors ${
                                !selectedPaper ? 'bg-gray-700' : ''
                              } rounded-t-lg`}
                            >
                            <span className="text-sm text-white">Select a Paper...</span>
                            </button>
                            {papers.map((paper) => (
                              <button
                                key={paper.id}
                                onClick={() => {
                                  setSelectedPaper(paper);
                                  setPaperDropdownOpen(false);
                                // Create new session with paper when paper is selected
                                if (!currentSession || currentSession.paper_id !== paper.id) {
                                  createNewChatWithPaper(paper);
                                }
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors ${
                                  selectedPaper?.id === paper.id ? 'bg-gray-700' : ''
                                } ${paper.id === papers[papers.length - 1]?.id ? 'rounded-b-lg' : ''}`}
                              >
                                <div className="text-sm text-white truncate">{paper.title}</div>
                                <div className="text-xs text-gray-400">{paper.arxiv_id}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 ml-auto">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Section:</span>
                          <select
                            value={sectionChunks}
                            onChange={(e) => setSectionChunks(parseInt(e.target.value))}
                          className="bg-gray-800 text-white px-2 py-1 rounded-full text-xs focus:outline-none"
                          >
                            {[1, 2, 3, 4, 5].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                        <span className="text-gray-400">Content:</span>
                          <select
                            value={contentChunks}
                            onChange={(e) => setContentChunks(parseInt(e.target.value))}
                          className="bg-gray-800 text-white px-2 py-1 rounded-full text-xs focus:outline-none"
                          >
                            {[1, 2, 3, 4, 5].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    {/* Input Row */}
                    <div className="flex items-end gap-3">
                      {selectedPaper && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-gray-600 rounded-full text-xs">
                          <FileText className="w-3 h-3 text-gray-300" />
                          <span className="text-gray-300">{selectedPaper.arxiv_id}</span>
                    </div>
                  )}
                      <div className="flex-1 relative">
                        <textarea
                          ref={inputRef}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Message DeepRxiv..."
                          className="w-full bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none"
                          rows={1}
                          style={{ minHeight: '24px', maxHeight: '120px' }}
                        />
                      </div>
                    <button
                        onClick={sendMessage}
                      disabled={!inputMessage.trim() || isLoading || !currentSession}
                      className="p-2 bg-gray-600 text-white rounded-full hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={!selectedPaper ? "Select a paper to enable RAG chat" : "Send message"}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                              </div>
                        </div>
                      </div>
                    </div>
          </div>
            </div>
      </div>

      {/* Sources Sidebar */}
      <ChatSidebar
        sources={currentSources.sources || []}
        citations={currentSources.citations || []}
        images={currentSources.images || []}
        highlighted_images={currentSources.highlighted_images || []}
        isOpen={sourcesSidebarOpen}
        onClose={() => setSourcesSidebarOpen(false)}
      />

      {/* Share Toast Notification */}
      <AnimatePresence>
        {shareToast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
              shareToast.type === 'success' 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {shareToast.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              )}
              <span className="text-sm font-medium">{shareToast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add this CSS to the custom styles at the beginning of the file: */}
      <style jsx global>{`
        /* Better styling for LaTeX equations */
        .latex-container .katex-display {
          overflow-x: auto;
          margin: 1em 0;
          padding: 0.5em 0;
        }
        
        .latex-container .katex {
          font-size: 1.1em;
        }
        
        .latex-container .katex-display > .katex {
          display: block;
          margin: 0 auto;
          text-align: center;
        }
        
        /* Inline math styling */
        .latex-container .katex[data-inline="true"] {
          font-size: inherit;
        }
        
        /* Better prose styling for math content */
        .latex-container.prose .katex-display {
          margin: 1.5rem 0;
        }
        
        .latex-container.prose p:has(.katex-display) {
          margin: 0;
        }
        
        /* Fix for dark theme */
        .latex-container .katex {
          color: inherit;
        }
        
        /* Scrollable math for long equations */
        .latex-container .katex-display {
          overflow-x: auto;
          overflow-y: hidden;
        }
      `}</style>
    </div>
  );
} 