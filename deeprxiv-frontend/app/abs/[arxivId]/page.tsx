'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getPaper, getPaperStatus } from '../../../utils/api';
import { 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  ChevronRight, 
  ChevronDown,
  Clock, 
  FileText,
  BookOpen,
  Code,
  AlertCircle,
  Menu
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
  
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [activeSubsection, setActiveSubsection] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [processingStatus, setProcessingStatus] = useState(null);
  
  const activeSectionRef = useRef(null);
  const sectionsRefs = useRef({});

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
        const initialExpandedSections = {};
        if (data.sections) {
          data.sections.forEach(section => {
            initialExpandedSections[section.id] = true;
          });
        }
        setExpandedSections(initialExpandedSections);
        
        setError(null);
      } catch (err) {
        console.error('Error loading paper:', err);
        setError(err.message || 'Failed to load paper');
        
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
    let intervalId;
    if (processingStatus) {
      intervalId = setInterval(async () => {
        try {
          const status = await getPaperStatus(arxivId);
          setProcessingStatus(status.progress || 'Processing');
          
          if (status.processed) {
            clearInterval(intervalId);
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

  // Scroll to active section when it changes
  useEffect(() => {
    if (activeSectionRef.current) {
      activeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection, activeSubsection]);
  
  // Initialize KaTeX for equation rendering
  useEffect(() => {
    const renderMathInElement = window.katex?.renderMathInElement;
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
  const currentSubsection = activeSubsection
    ? currentSection?.subsections?.find(sub => sub.id === activeSubsection)
    : null;
  
  const contentToDisplay = currentSubsection
    ? currentSubsection.content
    : currentSection?.content;
  
  // Get citations for the current section/subsection
  const currentCitations = currentSubsection?.citations || currentSection?.citations || [];
  
  // Function to render citations
  const renderCitations = () => {
    if (!paper?.citations || currentCitations.length === 0) return null;
    
    return (
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">References</h3>
        <ol className="list-decimal pl-5 space-y-2">
          {currentCitations.map((citationIndex) => {
            const citation = paper.citations[citationIndex];
            return (
              <li key={citationIndex} className="text-sm text-gray-700 dark:text-gray-300">
                <a 
                  href={citation.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-words"
                >
                  {citation.title || citation.url}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };
  
  // Function to toggle section expansion
  const toggleSectionExpand = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  // Function to create anchor links for headings
  const generateAnchorId = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');
  };
  
  // Convert content with equations, lists, code blocks
  const renderContent = (content) => {
    if (!content) return null;
    
    // Split content into paragraphs
    const paragraphs = content.split('\n\n');
    
    return paragraphs.map((paragraph, idx) => {
      // Check if it's a heading
      if (paragraph.startsWith('# ')) {
        const headingText = paragraph.substring(2);
        const headingId = generateAnchorId(headingText);
        return (
          <h2 id={headingId} key={idx} className="text-xl font-bold mt-6 mb-3 text-gray-800 dark:text-gray-200">
            {headingText}
          </h2>
        );
      } 
      // Check if it's a subheading
      else if (paragraph.startsWith('## ')) {
        const headingText = paragraph.substring(3);
        const headingId = generateAnchorId(headingText);
        return (
          <h3 id={headingId} key={idx} className="text-lg font-semibold mt-5 mb-2 text-gray-700 dark:text-gray-300">
            {headingText}
          </h3>
        );
      }
      // Check if it's a list
      else if (paragraph.match(/^[*-] /m)) {
        const listItems = paragraph.split(/\n[*-] /);
        return (
          <ul key={idx} className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            {listItems.map((item, i) => {
              // First item might still have the bullet
              const cleanItem = i === 0 ? item.replace(/^[*-] /, '') : item;
              return <li key={i} className="mb-1">{cleanItem}</li>;
            })}
          </ul>
        );
      }
      // Check if it's a code block
      else if (paragraph.startsWith('```') && paragraph.endsWith('```')) {
        const code = paragraph.substring(3, paragraph.length - 3);
        return (
          <div key={idx} className="bg-gray-100 dark:bg-gray-800 rounded-md p-3 my-4 overflow-x-auto font-mono text-sm">
            <pre>{code}</pre>
          </div>
        );
      }
      // Regular paragraph with math support
      else {
        return (
          <p key={idx} className="mb-4 text-gray-700 dark:text-gray-300 math-content leading-relaxed">
            {paragraph}
          </p>
        );
      }
    });
  };

  // Loading state
  if (loading && !paper) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading paper...</p>
        </div>
      </div>
    );
  }

  // Processing state
  if (processingStatus) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Clock className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Paper Processing</h2>
          </div>
          
          <div className="space-y-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full animate-pulse w-3/4"></div>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300">{processingStatus}</p>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This paper is still being processed. The page will automatically update when it's ready.
            </p>
            
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link 
                href="/"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
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
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4 text-red-600 dark:text-red-400">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Error Loading Paper</h2>
          </div>
          
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link 
              href="/"
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
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

      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="font-medium">DeepRxiv</span>
              </Link>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                {paper?.arxiv_id}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <a 
                href={`https://arxiv.org/abs/${paper?.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                <span>arXiv</span>
              </a>
              
              <a 
                href={`https://arxiv.org/pdf/${paper?.arxiv_id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>PDF</span>
              </a>
              
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar with sections - collapsible on mobile */}
          <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto`}>
            <div className="py-6 px-4">
              <div className="mb-6">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Paper Info</h3>
                
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    arXiv ID: {paper?.arxiv_id}
                  </div>
                  
                  {paper?.authors && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Authors</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        {paper.authors}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Sections</h3>
              <nav className="space-y-1">
                {paper?.sections?.map(section => (
                  <div key={section.id} className="mb-2">
                    <div className="flex items-start">
                      <button
                        onClick={() => toggleSectionExpand(section.id)}
                        className="mr-1 mt-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {expandedSections[section.id] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          setActiveSection(section.id);
                          setActiveSubsection(null);
                        }}
                        className={`flex w-full items-center py-1.5 text-sm font-medium rounded-md ${
                          activeSection === section.id && !activeSubsection
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
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
                            }}
                            className={`flex w-full items-center pl-2 py-1 text-xs font-medium rounded-md ${
                              activeSection === section.id && activeSubsection === subsection.id
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
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

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {/* Paper header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6">
              <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-5 text-gray-900 dark:text-white">
                  {paper?.title}
                </h1>
                
                {paper?.abstract && (
                  <div className="mb-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                    <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-2">Abstract</h2>
                    <p className="text-sm text-gray-700 dark:text-gray-300 math-content leading-relaxed">
                      {paper.abstract}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Section content */}
            <div className="py-8 px-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {currentSubsection 
                      ? `${currentSection?.title} / ${currentSubsection.title}` 
                      : currentSection?.title}
                  </span>
                </div>
                
                <div ref={activeSectionRef} className="prose dark:prose-invert max-w-none">
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-5">
                    {currentSubsection ? currentSubsection.title : currentSection?.title}
                  </h2>
                  
                  <div className="math-content">
                    {renderContent(contentToDisplay)}
                  </div>
                  
                  {renderCitations()}
                </div>
              </div>
            </div>
          </div>
          
          {/* Right sidebar with "On this page" (TOC) - desktop only */}
          <div className="hidden lg:block w-56 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="py-6 px-4">
              <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">On this page</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    activeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 block mb-2"
                >
                  {currentSubsection ? currentSubsection.title : currentSection?.title}
                </button>
                
                {/* This would be dynamically generated from the content */}
                {/* For now it's simplified */}
                <div className="pl-2 border-l border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 block">
                      Introduction
                    </button>
                    <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 block">
                      Methods
                    </button>
                    <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 block">
                      Results
                    </button>
                  </div>
                </div>
              </nav>
              
              {/* Metadata */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Source</h3>
                
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <a 
                    href={`https://arxiv.org/abs/${paper?.arxiv_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    <span>arxiv.org/abs/{paper?.arxiv_id}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 