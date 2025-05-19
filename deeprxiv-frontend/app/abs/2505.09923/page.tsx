'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Download, ChevronRight } from 'lucide-react';

// Paper data
const paperData = {
  arxiv_id: '2505.09923',
  title: 'Untitled Paper',
  authors: '',
  abstract: '',
};

// Sections data
const sectionsData = [{"id": "overview", "title": "Overview", "content": "Content generation for section 'Overview' failed.", "subsections": []}];

export default function PaperPage() {
  const [activeSection, setActiveSection] = useState(sectionsData[0]?.id);
  const [activeSubsection, setActiveSubsection] = useState(null);
  const activeSectionRef = useRef(null);
  
  // Scroll to the active section when it changes
  useEffect(() => {
    if (activeSectionRef.current) {
      activeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection, activeSubsection]);

  // Find the active section content
  const currentSection = sectionsData.find(section => section.id === activeSection);
  const currentSubsection = activeSubsection
    ? currentSection?.subsections?.find(sub => sub.id === activeSubsection)
    : null;
  
  const contentToDisplay = currentSubsection
    ? currentSubsection.content
    : currentSection?.content;

  return (
    <div className="flex flex-row min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Left sidebar with sections */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 py-6 px-4 hidden md:block overflow-y-auto">
        <Link 
          href="/" 
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Back to papers</span>
        </Link>

        <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium my-4">Sections</h3>
        <nav className="space-y-1">
          {sectionsData.map(section => (
            <div key={section.id} className="mb-3">
              <button
                onClick={() => {
                  setActiveSection(section.id);
                  setActiveSubsection(null);
                }}
                className={`flex w-full items-center pl-2 py-1.5 text-sm font-medium rounded-md ${
                  activeSection === section.id && !activeSubsection
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {section.title}
              </button>
              
              {/* Subsections */}
              {section.subsections && section.subsections.length > 0 && (
                <div className="pl-4 mt-1 space-y-1">
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

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Paper header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6">
          <div className="max-w-4xl mx-auto px-4">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-4">{paperData.title}</h1>
              
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span className="inline-flex items-center bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                  arXiv ID: {paperData.arxiv_id}
                </span>
                
                <a 
                  href={`https://arxiv.org/abs/${paperData.arxiv_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  <span>View on arXiv</span>
                </a>
                
                <a 
                  href={`https://arxiv.org/pdf/${paperData.arxiv_id}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span>Download PDF</span>
                </a>
              </div>
            </div>
            
            {paperData.authors && (
              <div className="mb-4">
                <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-1">Authors</h2>
                <p className="text-gray-800 dark:text-gray-200">{paperData.authors}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Section content */}
        <div className="max-w-4xl mx-auto px-4 py-8" ref={activeSectionRef}>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
            {currentSubsection ? currentSubsection.title : currentSection?.title}
          </h2>
          
          <div className="prose dark:prose-invert max-w-none">
            {contentToDisplay && contentToDisplay.split('\n').map((paragraph, idx) => (
              <p key={idx} className="mb-4 text-gray-700 dark:text-gray-300">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
