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
  id: 6,
  arxiv_id: '2410.01782',
  title: 'OPEN-RAG : Enhanced Retrieval-Augmented Reasoning with Open-Source Large Language Models',
  authors: 'Shayekh Bin Islam, Md Asib Rahman, K S M Tozammel Hossain, Enamul Hoque, Shafiq Joty, Md Rizwan Parvez',
  abstract: 'Retrieval-Augmented Generation (RAG) has been shown to enhance the factual accuracy of Large Language Models (LLMs), but existing methods often suffer from limited reasoning capabilities in effectively using the retrieved evidence, particularly when using open-source LLMs. To mitigate this gap, we introduce a novel framework, OPEN-RAG, designed to enhance reasoning capabilities in RAG with open-source LLMs. Our framework transforms an arbitrary dense LLM into a parameter-efficient sparse mixture of experts (MoE) model capable of handling complex reasoning tasks, including both single- and multi-hop queries. OPEN-RAG uniquely trains the model to navigate challenging distractors that appear relevant but are misleading. As a result, OPEN-RAG leverages latent learning, dynamically selecting relevant experts and integrating external knowledge effectively for more accurate and contextually relevant responses. In addition, we propose a hybrid adaptive retrieval method to determine retrieval necessity and balance the trade-off between performance gain and inference speed. Experimental results show that the Llama2-7B-based OPEN-RAG outperforms state-of-the-art LLMs and RAG models such as ChatGPT, Self-RAG, and Command R+ in various knowledge-intensive tasks. We open-source our code and models at https://openragmoe.github.io/',
  processed: true
};

// Sections data
const sectionsData: Section[] = [{"id": "overview", "title": "Overview", "content": "Retrieval-Augmented Generation (RAG) has been shown to enhance the factual accuracy of Large Language Models (LLMs), but existing methods often suffer from limited reasoning capabilities in effectively using the retrieved evidence, particularly when using open-source LLMs. To mitigate this gap, we introduce a novel framework, OPEN-RAG, designed to enhance reasoning capabilities in RAG with open-source LLMs. Our framework transforms an arbitrary dense LLM into a parameter-efficient sparse mixture of experts (MoE) model capable of handling complex reasoning tasks, including both single- and multi-hop queries. OPEN-RAG uniquely trains the model to navigate challenging distractors that appear relevant but are misleading. As a result, OPEN-RAG leverages latent learning, dynamically selecting relevant experts and integrating external knowledge effectively for more accurate and contextually relevant responses. In addition, we propose a hybrid adaptive retrieval method to determine retrieval necessity and balance the trade-off between performance gain and inference speed. Experimental results show that the Llama2-7B-based OPEN-RAG outperforms state-of-the-art LLMs and RAG models such as ChatGPT, Self-RAG, and Command R+ in various knowledge-intensive tasks. We open-source our code and models at https://openragmoe.github.io/", "citations": [], "subsections": []}];
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
    if (!sectionCitations || !Array.isArray(sectionCitations)) return citationsData || [];
    return sectionCitations;
  };
  
  const sectionCitations = getSectionCitations(currentSection?.citations);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center text-blue-600 hover:text-blue-700 transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-800 lowercase">deeprxiv</h1>
              <span className="text-lg text-gray-600 font-medium truncate max-w-md">
                {paperData.title}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <BookOpen className="w-4 h-4" />
              <span>arXiv:{paperData.arxiv_id}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Sections</h2>
              <nav className="space-y-2">
                {sectionsData?.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`block w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-500'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-400">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm">{section.title}</span>
                    </div>
                    {section.subsections && section.subsections.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1 ml-6">
                        {section.subsections.length} subsection{section.subsections.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Center Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {currentSection && (
                <>
                  {/* Section Header */}
                  <div className="mb-8 pb-6 border-b border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">
                      {currentSection.title}
                    </h1>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <BookOpen className="w-4 h-4" />
                        <span>{paperData.authors}</span>
                      </span>
                      {currentSection.page_number && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>Page {currentSection.page_number}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Main Section Content */}
                  <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed mb-8">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      className="prose prose-gray prose-lg max-w-none"
                      components={{
                        h1: ({children}) => <h1 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{children}</h1>,
                        h2: ({children}) => <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">{children}</h2>,
                        h3: ({children}) => <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">{children}</h3>,
                        p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
                        code: ({children}) => <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{children}</code>,
                        pre: ({children}) => <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto border">{children}</pre>
                      }}
                    >
                      {currentSection.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Subsections */}
                  {currentSection.subsections && currentSection.subsections.length > 0 && (
                    <div className="space-y-8">
                      <div className="border-t border-gray-200 pt-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-6">
                          Detailed Exploration
                        </h2>
                      </div>
                      {currentSection.subsections.map((subsection, index) => (
                        <div key={subsection.id} className="relative">
                          {/* Subsection Card */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-6 ml-4">
                            {/* Connecting Line */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 rounded-full"></div>
                            
                            {/* Subsection Header */}
                            <div className="mb-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                                  {index + 1}
                                </span>
                                <h3 className="text-lg font-semibold text-blue-900">
                                  {subsection.title}
                                </h3>
                              </div>
                              {subsection.page_number && (
                                <div className="flex items-center space-x-1 text-sm text-blue-600 ml-11">
                                  <Clock className="w-3 h-3" />
                                  <span>Page {subsection.page_number}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Subsection Content */}
                            <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed ml-11">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                className="prose prose-gray max-w-none"
                                components={{
                                  h1: ({children}) => <h1 className="text-lg font-semibold text-gray-800 mt-4 mb-2">{children}</h1>,
                                  h2: ({children}) => <h2 className="text-base font-medium text-gray-800 mt-3 mb-2">{children}</h2>,
                                  h3: ({children}) => <h3 className="text-base font-medium text-gray-700 mt-2 mb-1">{children}</h3>,
                                  p: ({children}) => <p className="mb-3 leading-relaxed text-sm">{children}</p>,
                                  code: ({children}) => <code className="bg-white px-2 py-1 rounded text-xs font-mono border">{children}</code>,
                                  pre: ({children}) => <pre className="bg-white p-3 rounded border overflow-x-auto text-xs">{children}</pre>
                                }}
                              >
                                {subsection.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar - Images and Sources */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
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
                    <div className="space-y-4">
                      {relevantImages.map((image, index) => (
                        <div
                          key={image.id || index}
                          className="bg-gray-50 rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <div className="aspect-square bg-white rounded flex items-center justify-center overflow-hidden mb-2">
                            <img
                              src={image.url || `/api/image/${image.id}`}
                              alt={`Figure ${index + 1}`}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <p className="text-xs text-gray-600 text-center">
                            Figure {index + 1} (Page {image.page})
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No images for this section</p>
                    </div>
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
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
