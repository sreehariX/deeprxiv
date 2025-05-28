'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getPaper, getPaperStatus, processArxivUrl, type PaperDetail } from '../../../utils/api';
import { 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  ChevronRight, 
  ChevronDown,
  Clock, 
  BookOpen,
  AlertCircle,
  Menu,
  Link as LinkIcon,
  File,
  Copy,
  Check,
  Share2,
  Youtube,
  Search,
  ArrowRight,
  MessageCircle
} from 'lucide-react';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import PaperSection from '../../../components/PaperSection';

export default function PaperPage() {
  const params = useParams();
  const router = useRouter();
  const arxivId = params.arxivId as string;
  
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeSubsection, setActiveSubsection] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [autoProcessing, setAutoProcessing] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionsRefs = useRef<Record<string, HTMLElement | null>>({});

  // Load paper data
  useEffect(() => {
    async function loadPaper() {
      try {
        setLoading(true);
        const data = await getPaper(arxivId);
        
        if (data) {
          setPaper(data);
          
          // Check URL for section parameter
          const urlParams = new URLSearchParams(window.location.search);
          const sectionParam = urlParams.get('section');
          
          // Set initial active section
          if (data.sections && data.sections.length > 0) {
            if (sectionParam) {
              // Find section by title
              const matchingSection = data.sections.find(s => 
                s.title.toLowerCase() === sectionParam.toLowerCase()
              );
              
              if (matchingSection) {
                setActiveSection(matchingSection.id);
              } else {
                // Check subsections
                for (const section of data.sections) {
                  if (section.subsections) {
                    const matchingSubsection = section.subsections.find(
                      sub => sub.title.toLowerCase() === sectionParam.toLowerCase()
                    );
                    if (matchingSubsection) {
                      setActiveSection(section.id);
                      setActiveSubsection(matchingSubsection.id);
                      break;
                    }
                  }
                }
              }
            } else {
              // Default to first section if no section parameter
              setActiveSection(data.sections[0].id);
            }
          }
          
          setError(null);
        } else {
          // Paper not found, check if it's being processed
          const status = await getPaperStatus(arxivId);
          
          if (status && !status.processed) {
            setProcessingStatus(status.progress || 'Processing');
          } else {
            // Paper doesn't exist and isn't processing - trigger auto-processing
            handleAutoRedirectAndProcess();
          }
        }
      } catch (err) {
        console.error('Error loading paper:', err);
        setError(err instanceof Error ? err.message : 'Failed to load paper');
        
        // If there's an error (not 404), still try to check status
        try {
          const status = await getPaperStatus(arxivId);
          if (status && !status.processed) {
            setProcessingStatus(status.progress || 'Processing');
          }
        } catch (statusErr) {
          console.error('Error checking paper status:', statusErr);
          // If both fail, it might be a connection issue - don't auto-process
        }
      } finally {
        setLoading(false);
      }
    }

    loadPaper();
    
    // If not processed, poll for updates
    let intervalId: NodeJS.Timeout | undefined;
    if (processingStatus) {
      intervalId = setInterval(async () => {
        try {
          const status = await getPaperStatus(arxivId);
          if (status) {
            setProcessingStatus(status.progress || 'Processing');
            
            if (status.processed) {
              if (intervalId) clearInterval(intervalId);
              loadPaper();
            }
          } else {
            // Status not found, paper might have been deleted or there's an issue
            console.log('Paper status not found, stopping polling');
            if (intervalId) clearInterval(intervalId);
          }
        } catch (err) {
          console.error('Error checking status:', err);
        }
      }, 5000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [arxivId, processingStatus]);

  // Function to handle auto-redirect and processing
  const handleAutoRedirectAndProcess = async () => {
    try {
      setAutoProcessing(true);
      const arxivUrl = `https://arxiv.org/abs/${arxivId}`;
      
      // Start processing the paper
      await processArxivUrl(arxivUrl);
      
      // Set processing status to start polling
      setProcessingStatus('Processing started automatically');
      setError(null);
      
    } catch (processErr) {
      console.error('Error auto-processing paper:', processErr);
      
      // If auto-processing fails, redirect to home with URL pre-filled
      const arxivUrl = `https://arxiv.org/abs/${arxivId}`;
      const encodedUrl = encodeURIComponent(arxivUrl);
      router.push(`/?url=${encodedUrl}&autoProcess=true`);
    }
  };

  // Handle scroll and reading progress
  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const contentElement = contentRef.current;
        const totalHeight = contentElement.scrollHeight - contentElement.clientHeight;
        const scrollPosition = contentElement.scrollTop;
        const progress = Math.min(100, Math.round((scrollPosition / totalHeight) * 100));
        setReadingProgress(progress);
      }
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll);
      return () => contentElement.removeEventListener('scroll', handleScroll);
    }
  }, [paper]);
  
  // Function to handle citation copying
  const handleCopyCitation = () => {
    if (!paper) return;
    
    const citation = `${paper.authors} (${new Date().getFullYear()}). ${paper.title}. arXiv preprint arXiv:${paper.arxiv_id}.`;
    navigator.clipboard.writeText(citation).then(() => {
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    });
  };
  
  // Function to share the paper
  const handleSharePaper = () => {
    if (navigator.share && paper) {
      navigator.share({
        title: paper.title,
        text: `Check out this paper: ${paper.title}`,
        url: window.location.href,
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback if Web Share API is not available
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Link copied to clipboard!');
      });
    }
  };
  
  // Function to search YouTube for videos about the paper
  const handleYouTubeSearch = () => {
    if (!paper?.title) return;
    
    const searchQuery = encodeURIComponent(`${paper.title} paper explanation`);
    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
  };
  
  // Function to search Perplexity for the paper
  const handlePerplexitySearch = () => {
    if (!paper?.title) return;
    
    const searchQuery = encodeURIComponent(`${paper.title} research paper`);
    window.open(`https://www.perplexity.ai/search?q=${searchQuery}`, '_blank');
  };

  // Function to open chat with this paper
  const handleOpenChat = async () => {
    if (!paper) return;
    
    try {
      // Create a new chat session with this paper
      const response = await fetch('http://localhost:8000/api/chat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Chat about ${paper.arxiv_id}`,
          paper_id: paper.id,
          is_public: true
        })
      });

      if (response.ok) {
        const session = await response.json();
        // Redirect to chat with the new session
        router.push(`/chat?session=${session.session_id}`);
      } else {
        // Fallback: redirect to chat page with paper info in URL
        router.push(`/chat?arxiv_id=${paper.arxiv_id}&paper_id=${paper.id}`);
      }
    } catch (error) {
      console.error('Error creating chat session:', error);
      // Fallback: redirect to chat page with paper info in URL
      router.push(`/chat?arxiv_id=${paper.arxiv_id}&paper_id=${paper.id}`);
    }
  };
  
  // Get current section
  const currentSection = paper?.sections?.find(section => section.id === activeSection);
  
  // Get filtered sections based on search query
  const filteredSections = !searchQuery || !paper?.sections 
    ? paper?.sections 
    : paper.sections.filter(section => 
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        section.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.subsections?.some(subsection => 
          subsection.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          subsection.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );

  // Loading state
  if (loading && !paper) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-b-4 border-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300 text-lg">Loading paper...</p>
        </div>
      </div>
    );
  }

  // Processing state
  if (processingStatus || autoProcessing) {
    const isAutoProcessing = autoProcessing || processingStatus?.includes('automatically');
    
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-5">
            <Clock className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-200">
              {isAutoProcessing ? 'Auto-Processing Paper' : 'Paper Processing'}
            </h2>
          </div>
          
          <div className="space-y-4">
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full animate-pulse w-3/4"></div>
            </div>
            
            <p className="text-gray-300 font-medium">
              {processingStatus || 'Starting automatic processing...'}
            </p>
            
            {isAutoProcessing && (
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  📄 Paper ID: <span className="font-mono">{arxivId}</span>
                </p>
                <p className="text-sm text-blue-300 mt-1">
                  This paper wasn't found in our database, so we're automatically processing it for you!
                </p>
              </div>
            )}
            
            <p className="text-sm text-gray-400">
              This paper is being processed. The page will automatically update when it's ready.
              {isAutoProcessing && ' This usually takes 1-2 minutes.'}
            </p>
            
            <div className="pt-4 mt-2 border-t border-gray-700">
              <Link
                href="/"
                className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Back to home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !paper) {
  return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-4 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Error Loading Paper</h2>
          </div>
          
          <p className="text-gray-300 mb-4">{error}</p>
          
          <div className="pt-4 border-t border-gray-700">
            <Link 
              href="/" 
              className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>Back to home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Successful paper load
  return (
      <div className="flex flex-col h-screen bg-gray-900">
        {/* Reading progress indicator */}
        <div className="fixed top-0 left-0 w-full h-1 z-50">
          <div 
            className="h-full bg-blue-500 transition-all duration-200 ease-out" 
            style={{ width: `${readingProgress}%` }}
          ></div>
        </div>

        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 py-3 px-4 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span className="font-medium">DeepRxiv</span>
              </Link>
              
              <div className="text-sm text-gray-400 hidden md:block">
                {paper?.arxiv_id}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
            {/* Chat button */}
            <button
              onClick={handleOpenChat}
              className="inline-flex items-center text-gray-300 hover:text-green-400 text-sm transition-colors"
              title="Chat about this paper"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1" />
              <span>Chat</span>
            </button>

            {/* Search button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-1.5 rounded-full hover:bg-gray-700 text-gray-300"
              title="Search in paper"
            >
              <Search className="w-5 h-5" />
            </button>
            
            {/* Citation button */}
              <button
                onClick={handleCopyCitation}
                className="hidden sm:inline-flex items-center text-gray-300 hover:text-blue-400 text-sm transition-colors"
                title="Copy citation"
              >
                {copiedCitation ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-green-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    <span>Cite</span>
                  </>
                )}
              </button>
              
            {/* YouTube search */}
            <button
              onClick={handleYouTubeSearch}
              className="hidden md:inline-flex items-center text-gray-300 hover:text-red-400 text-sm transition-colors"
              title="Find YouTube videos"
            >
              <Youtube className="w-3.5 h-3.5 mr-1" />
              <span>Videos</span>
            </button>
            
            {/* Perplexity search */}
              <button
              onClick={handlePerplexitySearch}
              className="hidden lg:inline-flex items-center text-gray-300 hover:text-purple-400 text-sm transition-colors"
              title="Search on Perplexity"
              >
              <Search className="w-3.5 h-3.5 mr-1" />
              <span>Perplexity</span>
              </button>
              
            {/* arXiv link */}
              <a 
                href={`https://arxiv.org/abs/${paper?.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center text-gray-300 hover:text-blue-400 text-sm transition-colors"
                title="View on arXiv"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                <span>arXiv</span>
              </a>
              
            {/* PDF link */}
              <a 
                href={`https://arxiv.org/pdf/${paper?.arxiv_id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center text-gray-300 hover:text-red-400 text-sm transition-colors"
                title="Download PDF"
              >
              <File className="w-3.5 h-3.5 mr-1" />
                <span>PDF</span>
              </a>
              
            {/* Sidebar toggle button for mobile */}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-full hover:bg-gray-700 text-gray-300 md:hidden"
              title={sidebarOpen ? "Hide sections" : "Show sections"}
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        
        {/* Search box */}
        {showSearch && (
          <div className="mt-3 px-2">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in paper..."
                className="w-full bg-gray-700 text-gray-200 rounded-md px-3 py-2 pl-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`bg-gray-800 border-r border-gray-700 w-72 overflow-y-auto transition-all duration-300 flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'
          }`}
        >
          {/* Paper title and authors */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold text-gray-100 mb-2">{paper?.title}</h2>
            <p className="text-sm text-gray-400">{paper?.authors}</p>
          </div>
              
          {/* Table of contents */}
          <nav className="p-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 px-3 py-2">Contents</h3>
            <div className="space-y-1">
              {filteredSections?.map((section) => (
                <div key={section.id} className="mb-2">
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center w-full text-left px-3 py-2 rounded-md transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-900/30 text-blue-400'
                        : 'hover:bg-gray-700/50 text-gray-300'
                    }`}
                  >
                    <span className="truncate">{section.title}</span>
                  </button>
              
                  {section.subsections && section.subsections.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1">
                      {section.subsections.map((subsection) => (
                        <button
                          key={subsection.id}
                          onClick={() => {
                            setActiveSection(section.id);
                            setActiveSubsection(subsection.id);
                          }}
                          className={`flex items-center w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                            activeSection === section.id && activeSubsection === subsection.id
                              ? 'bg-blue-900/20 text-blue-400'
                              : 'hover:bg-gray-700/50 text-gray-400'
                          }`}
                        >
                          <span className="truncate">{subsection.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>
        </aside>
      
          {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <div ref={contentRef} className="flex-1 overflow-y-auto p-4 md:p-8">
            {/* Paper abstract */}
            <div className="mb-8 max-w-4xl mx-auto">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-4">{paper?.title}</h1>
              <p className="text-gray-400 mb-6">{paper?.authors}</p>
              
              <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-8">
                <h2 className="text-xl font-semibold mb-3 text-gray-200">Abstract</h2>
                <p className="text-gray-300 leading-relaxed">{paper?.abstract}</p>
              </div>
            </div>
            
            {/* Show only the active section when there's a filter/search */}
            {searchQuery ? (
              <>
                <div className="mb-4 text-sm text-gray-400">
                  Search results for: <span className="text-gray-300">"{searchQuery}"</span>
                </div>
                <div className="space-y-8">
                  {filteredSections?.map((section) => (
                    <PaperSection 
                      key={section.id} 
                      section={section} 
                      isActive={true}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="max-w-4xl mx-auto">
                {currentSection && (
                  <div className="mb-10">
                    <h2 className="text-2xl font-bold text-gray-100 mb-6 pb-2 border-b border-gray-700">
                      {currentSection.title}
                    </h2>
                    <MarkdownRenderer 
                      content={currentSection.content} 
                      sourcePageNumber={currentSection.page_number}
                    />
                    
                    {currentSection.subsections && currentSection.subsections.length > 0 && (
                      <div className="mt-12 space-y-10">
                        {currentSection.subsections.map((subsection) => (
                          <div 
                            key={subsection.id}
                            id={subsection.id}
                            className="border-t border-gray-700 pt-6"
                          >
                            <h3 className="text-xl font-semibold mb-4 text-gray-200">
                              {subsection.title}
                            </h3>
                            <MarkdownRenderer 
                              content={subsection.content} 
                              sourcePageNumber={subsection.page_number}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              
                {/* Section navigation buttons */}
                {paper?.sections && paper.sections.length > 0 && (
                  <div className="flex justify-between pt-4 border-t border-gray-700 mt-10">
                    {/* Previous section button */}
                    {activeSection && (
                      <button
                        onClick={() => {
                          const currentIndex = paper.sections!.findIndex(s => s.id === activeSection);
                          if (currentIndex > 0) {
                            setActiveSection(paper.sections![currentIndex - 1].id);
                            setActiveSubsection(null);
                          }
                        }}
                        disabled={paper.sections.findIndex(s => s.id === activeSection) === 0}
                        className={`inline-flex items-center px-4 py-2 rounded-md border ${
                          paper.sections.findIndex(s => s.id === activeSection) === 0
                            ? 'border-gray-700 text-gray-500 cursor-not-allowed'
                            : 'border-gray-600 text-blue-400 hover:text-blue-300 hover:border-blue-500'
                        }`}
                      >
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        <span>Previous</span>
                      </button>
                    )}
                  
                    {/* Next section button */}
                    {activeSection && (
                      <button
                        onClick={() => {
                          const currentIndex = paper.sections!.findIndex(s => s.id === activeSection);
                          if (currentIndex < paper.sections!.length - 1) {
                            setActiveSection(paper.sections![currentIndex + 1].id);
                            setActiveSubsection(null);
                          }
                        }}
                        disabled={paper.sections.findIndex(s => s.id === activeSection) === paper.sections.length - 1}
                        className={`inline-flex items-center px-4 py-2 rounded-md border ${
                          paper.sections.findIndex(s => s.id === activeSection) === paper.sections.length - 1
                            ? 'border-gray-700 text-gray-500 cursor-not-allowed'
                            : 'border-gray-600 text-blue-400 hover:text-blue-300 hover:border-blue-500'
                        }`}
                      >
                        <span>Next</span>
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
} 