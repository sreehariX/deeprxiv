'use client';

import React, { useState, useMemo } from 'react';
import { X, ExternalLink, FileSearch, Images, Globe, Bookmark, FileText, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Source {
  index: string;
  type: string;
  title: string;
  similarity_score?: number;
  page_number?: number | string;
  section_id?: string;
  chunk_index?: number;
  estimated_page?: string | number;
  arxiv_id?: string;
  text?: string;
  full_text?: string;  // Full text for highlighting
}

// Add a more complete image interface that handles both our format and Perplexity format
interface ImageSource {
  // Our format
  url?: string;
  title?: string;
  description?: string;
  // Perplexity format
  image_url?: string;
  origin_url?: string;
  height?: number;
  width?: number;
}

interface ChatSidebarProps {
  sources: Source[];
  citations: string[];
  images: ImageSource[];
  highlighted_images: Array<{
    id: string;
    page: number;
    url: string;
    text_preview: string;
  }>;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatSidebar({
  sources = [],
  citations = [],
  images = [],
  highlighted_images = [],
  isOpen,
  onClose
}: ChatSidebarProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Log props for debugging
  console.log('ChatSidebar props:', { sources, citations, images, highlighted_images });

  // Deduplicate sources based on content similarity and type
  const deduplicateSources = (sources: Source[]) => {
    const seen = new Set<string>();
    const deduplicated: Source[] = [];
    
    for (const source of sources) {
      // Create a unique key based on content type, title, and page/section
      let key: string;
      if (source.type === 'content') {
        // For content chunks, use estimated page and chunk index
        key = `content-${source.estimated_page}-${source.chunk_index}`;
      } else if (source.type === 'section') {
        // For sections, use section ID or title
        key = `section-${source.section_id || source.title}`;
      } else if (source.type === 'subsection') {
        // For subsections, use subsection title to avoid duplicates
        key = `subsection-${source.title}`;
      } else {
        // Fallback for any other type
        key = `${source.type}-${source.title}-${source.page_number || 'no-page'}`;
      }
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(source);
      }
    }
    
    return deduplicated;
  };

  const uniqueSources = deduplicateSources(sources);

  // Separate content and section sources
  const contentSources = uniqueSources.filter(s => s.type === 'content');
  const sectionSources = uniqueSources.filter(s => s.type === 'section' || s.type === 'subsection');

  // Deduplicate sections by title to avoid showing duplicates
  const uniqueSectionSources = useMemo(() => {
    // First collect all section titles
    const sectionTitles = new Set<string>();
    const subsectionTitles = new Set<string>();
    
    // First pass: add all section titles to sets
    sectionSources.forEach(source => {
      if (source.type === 'section') {
        sectionTitles.add(source.title);
      } else if (source.type === 'subsection') {
        subsectionTitles.add(source.title);
      }
    });
    
    // Second pass: filter out duplicates, prioritizing sections over subsections
    return sectionSources.filter(source => {
      if (source.type === 'section') {
        // Always include unique sections
        return true;
      } else if (source.type === 'subsection') {
        // Only include if not already a section with the same title
        // and not already included as a subsection
        if (sectionTitles.has(source.title)) {
          return false; // Skip if there's a section with same title
        }
        
        if (subsectionTitles.has(source.title)) {
          // If this is a duplicate subsection title, only keep the first one
          subsectionTitles.delete(source.title); // Remove so we only keep first occurrence
          return true;
        }
        
        return true;
      }
      return false;
    });
  }, [sectionSources]);

  const handleImageClick = (imageUrl: string | undefined) => {
    if (imageUrl) {
      setSelectedImage(imageUrl);
    }
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const handleContentClick = async (source: Source) => {
    if (source.type === 'content' && source.arxiv_id && source.estimated_page) {
      // Direct PDF opening without highlighting
      const pageNum = source.estimated_page;
      const pdfUrl = `https://arxiv.org/pdf/${source.arxiv_id}.pdf#page=${pageNum}`;
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSectionClick = (source: Source) => {
    if ((source.type === 'section' || source.type === 'subsection') && source.arxiv_id) {
      // Open the specific paper with section as a query parameter instead of hash
      const sectionUrl = `/abs/${source.arxiv_id}?section=${encodeURIComponent(source.title)}`;
      window.open(sectionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3 
            }}
            className="fixed right-0 top-0 h-full w-96 bg-gray-900 text-white shadow-2xl z-40 rounded-l-2xl overflow-hidden"
            style={{ height: '100vh' }}
        >
          {/* Header */}
            <div className="p-4 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Sources & Media</h2>
              <button
                onClick={onClose}
                  className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100vh - 80px)' }}>
              
              {/* RAG Sources - Side by Side Layout */}
              {(contentSources.length > 0 || sectionSources.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                    <FileSearch className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-medium text-white">RAG Sources</h3>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                      {uniqueSources.length}
                    </span>
                  </div>

                  {/* Side by side grid for compact layout */}
                  <div className="grid grid-cols-1 gap-2">
                    {/* Raw Content Sources */}
                    {contentSources.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-2">
                          <FileText className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs font-medium text-yellow-400">Raw Content</span>
                          <span className="text-xs bg-yellow-600 text-white px-1 py-0.5 rounded-full">
                            {contentSources.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {contentSources.map((source, index) => (
                            <button
                              key={`content-${index}`}
                              onClick={() => handleContentClick(source)}
                              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer text-left group"
                              title={`Click to open PDF page ${source.estimated_page}`}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-xs font-medium text-yellow-400">
                                  {source.index}
                                </span>
                                {source.similarity_score && (
                                  <span className="text-xs text-gray-400">
                                    {(source.similarity_score * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-medium text-white mb-1 line-clamp-2">
                                {source.title}
                              </h4>
                              {source.estimated_page && (
                                <p className="text-xs text-gray-400 mb-1">
                                  Page {source.estimated_page}
                                </p>
                              )}
                              {source.text && (
                                <p className="text-xs text-gray-300 leading-tight line-clamp-3">
                                  {source.text}
                                </p>
                              )}
                              <div className="text-xs text-yellow-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                📄 Click to view PDF page
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section Sources */}
                    {uniqueSectionSources.length > 0 && (
                      <div className={contentSources.length > 0 ? "mt-3" : ""}>
                        <div className="flex items-center gap-1 mb-2">
                          <BookOpen className="w-3 h-3 text-green-400" />
                          <span className="text-xs font-medium text-green-400">Sections</span>
                          <span className="text-xs bg-green-600 text-white px-1 py-0.5 rounded-full">
                            {uniqueSectionSources.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {uniqueSectionSources.map((source, index) => (
                            <button
                              key={`section-${index}`}
                              onClick={() => handleSectionClick(source)}
                              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer text-left group"
                              title={`Click to open ${source.type === 'section' ? 'section' : 'subsection'}: ${source.title}`}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-xs font-medium text-green-400">
                                  {source.index}
                                </span>
                                {source.similarity_score && (
                                  <span className="text-xs text-gray-400">
                                    {(source.similarity_score * 100).toFixed(0)}%
                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-medium text-white mb-1 line-clamp-2">
                                {source.title}
                              </h4>
                              {source.page_number && source.page_number !== 'N/A' && (
                                <p className="text-xs text-gray-400 mb-1">
                                  Page {source.page_number}
                                </p>
                              )}
                              {source.text && (
                                <p className="text-xs text-gray-300 leading-tight line-clamp-3">
                                  {source.text}
                                </p>
                              )}
                              <div className="text-xs text-green-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                📖 Click to view section
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Highlighted Images from Papers */}
              {highlighted_images && highlighted_images.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Bookmark className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-medium text-white">Paper Images</h3>
                    <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                      {highlighted_images.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {highlighted_images.map((image, index) => (
                      <div
                        key={image.id || index}
                        className="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all group"
                        onClick={() => handleImageClick(image.url)}
                      >
                      <img
                        src={image.url}
                          alt={`Paper image from page ${image.page}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                            console.error('Failed to load highlighted image:', image.url);
                            e.currentTarget.style.display = 'none';
                        }}
                      />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1">
                          Page {image.page}
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

              {/* Perplexity Web Images */}
              {images && images.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                    <Images className="w-4 h-4 text-green-400" />
                    <h3 className="text-sm font-medium text-white">Web Images</h3>
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                      {images.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {images.map((image, index) => {
                    // Get the image URL from either our format or Perplexity format
                    const imageUrl = image.url || image.image_url;
                    if (!imageUrl) return null;
                    
                    // Get title or hostname from origin URL
                    let imageCaption = image.title;
                    if (!imageCaption && image.origin_url) {
                      try {
                        imageCaption = new URL(image.origin_url).hostname;
                      } catch (e) {
                        imageCaption = 'Web image';
                      }
                    }
                    
                    return (
                      <div
                        key={index}
                        className="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-green-400 transition-all group"
                        onClick={() => handleImageClick(imageUrl)}
                      >
                        <img
                          src={imageUrl}
                          alt={imageCaption || `Web image ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            console.error('Failed to load web image:', imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        {imageCaption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate">
                            {imageCaption}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

              {/* Web Citations/Sources */}
              {citations && citations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-orange-400" />
                    <h3 className="text-sm font-medium text-white">Web Sources</h3>
                    <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full">
                      {citations.length}
                  </span>
                </div>
                  {/* Compact grid layout for citations too */}
                  <div className="grid grid-cols-1 gap-2">
                    {citations.map((citation, index) => (
                      <div key={index} className="p-2 bg-gray-800 rounded-lg">
                      <div className="flex items-start gap-2">
                          <ExternalLink className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-300 mb-1">
                              Source {index + 1}
                            </p>
                            <p className="text-xs text-gray-400 break-words line-clamp-2">
                              {citation}
                            </p>
                              <button
                              onClick={() => window.open(citation, '_blank', 'noopener,noreferrer')}
                              className="text-xs text-orange-400 hover:text-orange-300 hover:underline mt-1"
                            >
                              Visit source
                              </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
              {(!uniqueSources || uniqueSources.length === 0) && 
             (!citations || citations.length === 0) && 
               (!images || images.length === 0) && 
               (!highlighted_images || highlighted_images.length === 0) && (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileSearch className="w-6 h-6 text-gray-400" />
                </div>
                  <p className="text-sm text-gray-400 mb-2">No sources available</p>
                  <p className="text-xs text-gray-500">
                    Sources and images will appear here when available
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
            onClick={closeImageModal}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-4xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                  onClick={() => window.open(selectedImage, '_blank', 'noopener,noreferrer')}
                  className="text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2"
                  title="View in new tab"
                >
                  <ExternalLink className="w-6 h-6" />
                </button>
                <button
                  onClick={closeImageModal}
                  className="text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2"
                  title="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <img
                src={selectedImage}
                alt="Enlarged view"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}