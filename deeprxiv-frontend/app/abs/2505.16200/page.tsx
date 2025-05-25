'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Image as ImageIcon, ExternalLink, BookOpen, Clock } from 'lucide-react';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Types for better TypeScript support
interface ImageData {
  id: string;
  page: number;
  original_position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  expanded_position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  path?: string;
  url?: string;
}

interface SubSection {
  id: string;
  title: string;
  content: string;
  citations?: string[];
  page_number?: number;
}

interface Section {
  id: string;
  title: string;
  content: string;
  citations?: string[];
  page_number?: number;
  subsections?: SubSection[];
}

// Paper data
const paperData = {
  id: 8,
  arxiv_id: '2505.16200',
  title: 'Advanced Integration Strategies for ESD Protection and Termination in High-Speed LVDS Systems: A Comprehensive Design Approach',
  authors: 'Kavya Gaddipati',
  abstract: 'This technical article explores comprehensive strategies for integrating Electrostatic Discharge (ESD) protection diodes and termination resistors in Low-Voltage Differential Signaling (LVDS) designs. The article examines critical aspects of protection mechanisms, design considerations, impedance matching, and placement optimization techniques. Through detailed analysis of layout considerations and advanced design strategies, the article presents solutions for common integration challenges. It emphasizes the importance of signal integrity maintenance and protection effectiveness while providing practical guidelines for implementing robust LVDS systems. Various methodologies for performance optimization and validation are discussed, offering designers a thorough framework for creating reliable high-speed digital systems that balance protection requirements with signal integrity demands.',
  processed: true
};

// Sections data
const sectionsData: Section[] = [{"id": "overview", "title": "Overview", "content": "This technical article explores comprehensive strategies for integrating Electrostatic Discharge (ESD) protection diodes and termination resistors in Low-Voltage Differential Signaling (LVDS) designs. The article examines critical aspects of protection mechanisms, design considerations, impedance matching, and placement optimization techniques. Through detailed analysis of layout considerations and advanced design strategies, the article presents solutions for common integration challenges. It emphasizes the importance of signal integrity maintenance and protection effectiveness while providing practical guidelines for implementing robust LVDS systems. Various methodologies for performance optimization and validation are discussed, offering designers a thorough framework for creating reliable high-speed digital systems that balance protection requirements with signal integrity demands.", "citations": [], "subsections": []}];
const citationsData: string[] = [];

export default function PaperPage() {
  const [activeSection, setActiveSection] = useState('');
  const [activeTab, setActiveTab] = useState<'images' | 'sources'>('sources'); // Default to sources
  const [imagesData, setImagesData] = useState<ImageData[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  
  // Fetch images from API
  useEffect(() => {
    const fetchImages = async () => {
      try {
        setImagesLoading(true);
        const response = await fetch(`http://localhost:8000/api/images/${paperData.arxiv_id}`);
        if (response.ok) {
          const images = await response.json();
          setImagesData(images);
          // If images are available, switch to images tab
          if (images && images.length > 0) {
            setActiveTab('images');
          }
        } else {
          console.error('Failed to fetch images:', response.statusText);
          setImagesData([]);
        }
      } catch (error) {
        console.error('Error fetching images:', error);
        setImagesData([]);
      } finally {
        setImagesLoading(false);
      }
    };

    fetchImages();
  }, []);
  
  // Initialize with the first section
  useEffect(() => {
    if (sectionsData?.length > 0) {
      setActiveSection(sectionsData[0].id);
    }
  }, []);
  
  // Get current section
  const currentSection = sectionsData?.find(section => section.id === activeSection);
  
  // Get relevant images for current section
  const getRelevantImages = (pageNumber: number | undefined): ImageData[] => {
    if (!pageNumber || !imagesData || !Array.isArray(imagesData)) return [];
    return imagesData.filter(img => img.page === pageNumber);
  };
  
  const relevantImages = getRelevantImages(currentSection?.page_number);
  
  // Get citations for current section
  const getSectionCitations = (sectionCitations?: string[]): string[] => {
    if (!sectionCitations || !Array.isArray(sectionCitations)) return [];
    return sectionCitations;
  };
  
  const sectionCitations = getSectionCitations(currentSection?.citations);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center text-blue-600 hover:text-blue-700">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-800 lowercase">deeprxiv</h1>
              <span className="text-lg text-gray-600 font-medium truncate max-w-md">
                {paperData.title}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-0 py-0">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-0 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <aside className="lg:col-span-1 bg-white p-6 border-r border-gray-200">
            <nav className="space-y-1">
              {sectionsData?.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`block w-full text-left px-4 py-2.5 rounded-md transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* Center Content Area */}
          <div className="lg:col-span-3 bg-white p-6">
            {currentSection && (
              <>
                <h3 className="text-2xl font-semibold text-gray-800 mb-2">
                  {currentSection.title}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  arXiv:{paperData.arxiv_id} • {paperData.authors}
                </p>
                <div className="prose max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    className="prose prose-gray max-w-none"
                  >
                    {currentSection.content}
                  </ReactMarkdown>
                </div>
                
                {/* Subsections */}
                {currentSection.subsections && currentSection.subsections.length > 0 && (
                  <div className="mt-8 space-y-8">
                    {currentSection.subsections.map((subsection) => (
                      <div key={subsection.id} className="ml-6 border-l-4 border-blue-100 pl-6 py-4">
                        <h4 className="text-xl font-semibold text-gray-800 mb-4 text-blue-700">
                          {subsection.title}
                        </h4>
                        <div className="prose max-w-none text-gray-700 leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            className="prose prose-gray max-w-none"
                          >
                            {subsection.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Sidebar - Images and Sources */}
          <aside className="lg:col-span-1 bg-white p-6 border-l border-gray-200">
            {/* Tab Buttons */}
            <div className="flex mb-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('images')}
                className={`flex-1 py-2 px-4 text-center font-medium transition-colors border-b-2 ${
                  activeTab === 'images'
                    ? 'text-blue-700 border-blue-700 font-semibold'
                    : 'text-gray-600 border-transparent hover:text-gray-800'
                }`}
              >
                <ImageIcon className="inline-block w-4 h-4 mr-1" />
                Images
              </button>
              <button
                onClick={() => setActiveTab('sources')}
                className={`flex-1 py-2 px-4 text-center font-medium transition-colors border-b-2 ${
                  activeTab === 'sources'
                    ? 'text-blue-700 border-blue-700 font-semibold'
                    : 'text-gray-600 border-transparent hover:text-gray-800'
                }`}
              >
                <ExternalLink className="inline-block w-4 h-4 mr-1" />
                Sources
              </button>
            </div>

            {/* Images Tab Content */}
            {activeTab === 'images' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Figures and tables related to the current section.
                </p>
                {imagesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading images...</p>
                  </div>
                ) : relevantImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {relevantImages.map((image, index) => (
                      <div
                        key={image.id || index}
                        className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden"
                      >
                        <img
                          src={image.url || `/api/image/${image.id}`}
                          alt={`Figure ${index + 1}`}
                          className="max-w-full max-h-full object-contain p-2"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No images for this section</p>
                  </div>
                )}
                {relevantImages.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click on an image to enlarge.
                  </p>
                )}
              </div>
            )}

            {/* Sources Tab Content */}
            {activeTab === 'sources' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Citations and references mentioned in this section.
                </p>
                {sectionCitations.length > 0 ? (
                  <div className="space-y-3">
                    {sectionCitations.map((citation, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start space-x-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full flex-shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 mb-1">
                              Reference {index + 1}
                            </p>
                            <p className="text-xs text-gray-600 break-words">
                              {citation}
                            </p>
                            <a
                              href={citation}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline mt-2"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View Source
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No citations for this section</p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
