'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getPaper, getPaperStatus, type PaperDetail } from '../../../utils/api';
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
  Share2
} from 'lucide-react';
import Script from 'next/script';

// KaTeX CSS for equation rendering
const KatexCSS = () => (
  <>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
      integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn"
      crossOrigin="anonymous"
    />
  </>
);

export default function PaperPage() {
  const params = useParams();
  const arxivId = params.arxivId as string;
  
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeSubsection, setActiveSubsection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [copiedCitation, setCopiedCitation] = useState(false);
  
  const activeSectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionsRefs = useRef<Record<string, HTMLElement | null>>({});

  // Load paper data
  useEffect(() => {
    async function loadPaper() {
      try {
        setLoading(true);
        const data = await getPaper(arxivId);
        setPaper(data);
        
        // Set initial active section
        if (data.sections && data.sections.length > 0) {
          setActiveSection(data.sections[0].id);
        }
        
        // Initialize expanded sections
        const initialExpandedSections: Record<string, boolean> = {};
        if (data.sections) {
          data.sections.forEach(section => {
            initialExpandedSections[section.id] = true;
          });
        }
        setExpandedSections(initialExpandedSections);
        
        setError(null);
      } catch (err) {
        console.error('Error loading paper:', err);
        setError(err instanceof Error ? err.message : 'Failed to load paper');
        
        // Check if the paper is still processing
        try {
          const status = await getPaperStatus(arxivId);
          if (!status.processed) {
            setProcessingStatus(status.progress || 'Processing');
          }
        } catch (statusErr) {
          console.error('Error checking paper status:', statusErr);
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
          setProcessingStatus(status.progress || 'Processing');
          
          if (status.processed) {
            if (intervalId) clearInterval(intervalId);
            loadPaper();
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

  // Scroll to active section when it changes
  useEffect(() => {
    if (activeSectionRef.current) {
      activeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection, activeSubsection]);
  
  // Initialize KaTeX for equation rendering
  useEffect(() => {
    const renderMathInElement = (window as any).katex?.renderMathInElement;
    if (renderMathInElement && paper) {
      document.querySelectorAll('.math-content').forEach(el => {
        renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      });
    }
  }, [paper, activeSection, activeSubsection]);

  // Find current section and subsection content
  const currentSection = paper?.sections?.find(section => section.id === activeSection);
  const currentSubsection = activeSubsection && currentSection?.subsections
    ? currentSection.subsections.find(sub => sub.id === activeSubsection)
    : null;
  
  const contentToDisplay = currentSubsection
    ? currentSubsection.content
    : currentSection?.content;
  
  // Get citations for the current section/subsection
  const currentCitations = currentSubsection?.citations || currentSection?.citations || [];
  
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
  
  // Function to render citations
  const renderCitations = () => {
    if (!paper?.citations || currentCitations.length === 0) return null;
    
    return (
      <div className="mt-8 pt-6 border-t border-gray-600/30">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">References</h3>
        <ol className="list-decimal pl-5 space-y-2">
          {currentCitations.map((citationIndex: number) => {
            const citation = paper.citations?.[citationIndex];
            if (!citation) return null;
            return (
              <li key={citationIndex} className="text-sm text-gray-300">
                <a 
                  href={citation.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline break-words flex items-start group"
                >
                  <LinkIcon className="w-3.5 h-3.5 mr-1.5 mt-1 flex-shrink-0 transition-all group-hover:text-blue-300" />
                  <span>{citation.title || citation.url}</span>
                </a>
              </li>
            );
          })}
        </ol>
              </div>
    );
  };
  
  // Function to toggle section expansion
  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  // Function to create anchor links for headings
  const generateAnchorId = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');
  };
  
  // Extract headings from content for the TOC
  const extractHeadings = (content: string) => {
    if (!content) return [];
    
    const headings: {id: string, text: string, level: number}[] = [];
    const paragraphs = content.split('\n\n');
    
    paragraphs.forEach((paragraph, idx) => {
      if (paragraph.startsWith('# ')) {
        const text = paragraph.substring(2);
        headings.push({
          id: `heading-${idx}`,
          text,
          level: 1
        });
      } else if (paragraph.startsWith('## ')) {
        const text = paragraph.substring(3);
        headings.push({
          id: `subheading-${idx}`,
          text,
          level: 2
        });
      }
    });
    
    return headings;
  };
  
  // Get headings for TOC
  const contentHeadings = contentToDisplay ? extractHeadings(contentToDisplay) : [];
  
  // Convert content with equations, lists, code blocks
  const renderContent = (content: string) => {
    if (!content) return null;
    
    // Split content into paragraphs
    const paragraphs = content.split('\n\n');
    
    return paragraphs.map((paragraph, idx) => {
      // Check if it's a heading
      if (paragraph.startsWith('# ')) {
        const headingText = paragraph.substring(2);
        const headingId = `heading-${idx}`;
        return (
          <h2 id={headingId} key={idx} className="text-xl font-bold mt-8 mb-4 text-gray-100 border-b border-gray-700 pb-2 group">
            {headingText}
            <a href={`#${headingId}`} className="ml-2 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity">
              #
            </a>
          </h2>
        );
      } 
      // Check if it's a subheading
      else if (paragraph.startsWith('## ')) {
        const headingText = paragraph.substring(3);
        const headingId = `subheading-${idx}`;
        return (
          <h3 id={headingId} key={idx} className="text-lg font-semibold mt-6 mb-3 text-gray-200 group">
            {headingText}
            <a href={`#${headingId}`} className="ml-2 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity">
              #
            </a>
          </h3>
        );
      }
      // Check if it's a list
      else if (paragraph.match(/^[*-] /m)) {
        const listItems = paragraph.split(/\n[*-] /);
        return (
          <ul key={idx} className="list-disc pl-6 mb-4 text-gray-300">
            {listItems.map((item, i) => {
              // First item might still have the bullet
              const cleanItem = i === 0 ? item.replace(/^[*-] /, '') : item;
              return <li key={i} className="mb-2 math-content">{cleanItem}</li>;
            })}
          </ul>
        );
      }
      // Check if it's a code block
      else if (paragraph.startsWith('```') && paragraph.endsWith('```')) {
        const langMatch = paragraph.match(/^```(\w+)/);
        const language = langMatch ? langMatch[1] : '';
        const code = paragraph.substring(3 + language.length, paragraph.length - 3);
        
        return (
          <div key={idx} className="relative bg-gray-800/80 rounded-md p-4 my-5 overflow-x-auto border border-gray-700/70 group">
            {language && (
              <div className="text-xs text-gray-400 mb-2 font-mono border-b border-gray-700/50 pb-2 px-1">{language}</div>
            )}
            <pre className="text-gray-300">{code}</pre>
            <button 
              className="absolute top-2 right-2 p-1.5 rounded bg-gray-700/50 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-700 hover:text-gray-200 transition-all"
              onClick={() => {
                navigator.clipboard.writeText(code);
                // Could add a copied indicator here
              }}
              title="Copy code"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        );
      }
      // Regular paragraph with math support
      else {
        return (
          <p key={idx} className="mb-4 text-gray-300 math-content leading-relaxed">
            {paragraph}
          </p>
        );
      }
    });
  };

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
  if (processingStatus) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-5">
            <Clock className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-200">Paper Processing</h2>
          </div>
          
          <div className="space-y-4">
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full animate-pulse w-3/4"></div>
            </div>
            
            <p className="text-gray-300 font-medium">{processingStatus}</p>
            
            <p className="text-sm text-gray-400">
              This paper is still being processed. The page will automatically update when it's ready.
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
    <>
      <KatexCSS />
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"
        integrity="sha384-cpW21h6RZv/phavutF+AuVYrr+dA8xD9zs6FwLpaCct6O9ctzYFfFr4dgmgccOTx"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"
        integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

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
              
              <button
                onClick={handleSharePaper}
                className="hidden sm:inline-flex items-center text-gray-300 hover:text-blue-400 text-sm transition-colors"
                title="Share paper"
              >
                <Share2 className="w-3.5 h-3.5 mr-1" />
                <span>Share</span>
              </button>
              
              <a 
                href={`https://arxiv.org/abs/${paper?.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-300 hover:text-blue-400 text-sm transition-colors"
                title="View on arXiv"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                <span>arXiv</span>
              </a>
              
              <a 
                href={`https://arxiv.org/pdf/${paper?.arxiv_id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-300 hover:text-blue-400 text-sm transition-colors"
                title="Download PDF"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>PDF</span>
              </a>
              
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden inline-flex items-center text-gray-300 hover:text-blue-400 text-sm transition-colors p-1"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar with sections - collapsible on mobile */}
          <div 
            className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto transition-all duration-300 ease-in-out`}
          >
            <div className="py-6 px-4">
              <div className="mb-6">
                <h3 className="text-sm uppercase tracking-wider text-gray-400 font-medium mb-3">Paper Info</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center text-xs text-gray-400">
                    <File className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                    <span>{paper?.arxiv_id}</span>
            </div>
                  
                  {paper?.authors && (
                    <div className="border-t border-gray-700/50 pt-3">
                      <div className="text-xs text-gray-400 font-medium mb-1.5">Authors</div>
                      <div className="text-xs text-gray-300 leading-relaxed">
                        {paper.authors}
              </div>
            </div>
          )}
                </div>
              </div>
              
              <div className="border-t border-gray-700/50 pt-5">
                <h3 className="text-sm uppercase tracking-wider text-gray-400 font-medium mb-3 flex justify-between items-center">
                  <span>Sections</span>
                  <span className="text-xs text-gray-500">{paper?.sections?.length || 0} sections</span>
                </h3>
                <nav className="space-y-1.5">
                  {paper?.sections?.map(section => (
                    <div key={section.id} className="mb-2.5">
                      <div className="flex items-start">
              <button
                          onClick={() => toggleSectionExpand(section.id)}
                          className="mr-1 mt-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                          aria-label={expandedSections[section.id] ? "Collapse section" : "Expand section"}
                        >
                          {expandedSections[section.id] ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
              </button>
              
              <button
                          onClick={() => {
                            setActiveSection(section.id);
                            setActiveSubsection(null);
                            // On mobile, close sidebar after selection
                            if (window.innerWidth < 768) {
                              setSidebarOpen(false);
                            }
                          }}
                          className={`flex w-full items-center py-1.5 text-sm font-medium rounded-md transition-colors ${
                            activeSection === section.id && !activeSubsection
                              ? 'bg-blue-900/30 text-blue-400 font-semibold'
                              : 'text-gray-300 hover:bg-gray-700/50'
                          }`}
                        >
                          {section.title}
                        </button>
                      </div>
                      
                      {/* Subsections */}
                      {expandedSections[section.id] && section.subsections && section.subsections.length > 0 && (
                        <div className="pl-6 mt-1 space-y-1">
                          {section.subsections.map(subsection => (
                            <button
                              key={subsection.id}
                              onClick={() => {
                                setActiveSection(section.id);
                                setActiveSubsection(subsection.id);
                                // On mobile, close sidebar after selection
                                if (window.innerWidth < 768) {
                                  setSidebarOpen(false);
                                }
                              }}
                              className={`flex w-full items-center pl-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                activeSection === section.id && activeSubsection === subsection.id
                                  ? 'bg-blue-900/30 text-blue-400'
                                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
                              }`}
                            >
                              <ChevronRight className="w-3 h-3 mr-1 opacity-70" />
                              {subsection.title}
              </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
            </nav>
          </div>
        </div>
      </div>
      
          {/* Main content */}
          <div className="flex-1 overflow-auto" ref={contentRef}>
            {/* Paper header */}
            <div className="bg-gray-800 border-b border-gray-700 py-8 px-5 shadow-md">
              <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-6 text-gray-100 math-content">
                  {paper?.title}
                </h1>
                
                {paper?.abstract && (
                  <div className="mb-5 bg-gray-800/80 border border-gray-700 rounded-lg p-5">
                    <h2 className="text-sm uppercase tracking-wider text-gray-400 font-medium mb-3">Abstract</h2>
                    <p className="text-sm text-gray-300 math-content leading-relaxed">
                      {paper.abstract}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Section content */}
            <div className="py-8 px-5 bg-gray-900">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-2 text-sm text-gray-400 mb-8">
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {currentSubsection 
                      ? `${currentSection?.title} / ${currentSubsection.title}` 
                      : currentSection?.title}
                  </span>
                </div>
                
                <div ref={activeSectionRef} className="prose prose-invert max-w-none">
                  <h2 className="text-2xl font-semibold text-gray-100 mb-6 pb-2 border-b border-gray-700/70">
                    {currentSubsection ? currentSubsection.title : currentSection?.title}
                  </h2>
                  
                  <div className="math-content text-gray-300 leading-relaxed">
                    {renderContent(contentToDisplay || '')}
                  </div>
                  
                  {renderCitations()}
                </div>
              </div>
            </div>
          </div>
          
          {/* Right sidebar with "On this page" (TOC) - desktop only */}
          <div className="hidden lg:block w-56 bg-gray-800 border-l border-gray-700 overflow-y-auto">
            <div className="py-6 px-4 sticky top-0">
              <h3 className="text-sm uppercase tracking-wider text-gray-400 font-medium mb-3">On this page</h3>
              <nav>
                <button
                  onClick={() => {
                    activeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 block mb-3 font-medium transition-colors"
                >
                  {currentSubsection ? currentSubsection.title : currentSection?.title}
                </button>
                
                {/* Content headings for navigation */}
                {contentHeadings.length > 0 && (
                  <div className="pl-2 border-l border-gray-700 mt-4">
                    <div className="space-y-2.5">
                      {contentHeadings.map((heading, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`text-xs ${heading.level === 1 ? 'text-gray-300' : 'text-gray-400 pl-2'} hover:text-blue-400 block transition-colors`}
                        >
                          {heading.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </nav>
              
              {/* Metadata and actions */}
              <div className="mt-8 pt-6 border-t border-gray-700">
                <h3 className="text-sm uppercase tracking-wider text-gray-400 font-medium mb-3">Actions</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={handleCopyCitation}
                    className="flex items-center text-gray-300 hover:text-blue-400 text-xs w-full transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    <span>{copiedCitation ? "Citation copied!" : "Copy citation"}</span>
                  </button>
                  
                  <button
                    onClick={handleSharePaper}
                    className="flex items-center text-gray-300 hover:text-blue-400 text-xs w-full transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                    <span>Share paper</span>
                  </button>
                  
                  <a 
                    href={`https://arxiv.org/abs/${paper?.arxiv_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-gray-300 hover:text-blue-400 text-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    <span>arxiv.org/abs/{paper?.arxiv_id}</span>
                  </a>
                </div>
              </div>
              </div>
          </div>
        </div>
        
        {/* Mobile action buttons - fixed at bottom */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 py-2 px-4 flex justify-around z-40">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex flex-col items-center justify-center text-gray-400 hover:text-blue-400 transition-colors text-xs py-1 px-2"
          >
            <Menu className="w-5 h-5 mb-1" />
            <span>Sections</span>
          </button>
          
          <button
            onClick={handleCopyCitation}
            className="flex flex-col items-center justify-center text-gray-400 hover:text-blue-400 transition-colors text-xs py-1 px-2"
          >
            <Copy className="w-5 h-5 mb-1" />
            <span>Cite</span>
          </button>
          
          <button
            onClick={handleSharePaper}
            className="flex flex-col items-center justify-center text-gray-400 hover:text-blue-400 transition-colors text-xs py-1 px-2"
          >
            <Share2 className="w-5 h-5 mb-1" />
            <span>Share</span>
          </button>
          
          <a 
            href={`https://arxiv.org/pdf/${paper?.arxiv_id}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center text-gray-400 hover:text-blue-400 transition-colors text-xs py-1 px-2"
          >
            <Download className="w-5 h-5 mb-1" />
            <span>PDF</span>
          </a>
        </div>
      </div>
    </>
  );
} 