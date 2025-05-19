'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPaperDetails, getPaperImages, PaperDetail, Image } from '../../../utils/api';
import LoadingState from '../../../components/LoadingState';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, FileText, AlertCircle, Download } from 'lucide-react';

// Backend URL for images
const BACKEND_URL = 'http://127.0.0.1:8000/api';

export default function PaperPage({ params }: { params: { arxivId: string } }) {
  const { arxivId } = params;
  const router = useRouter();
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'images'>('text');

  useEffect(() => {
    const fetchPaperDetails = async () => {
      try {
        setLoading(true);
        // Fetch paper details
        const paperData = await getPaperDetails(arxivId as string);
        setPaper(paperData);
        
        // Fetch paper images
        try {
          const imageData = await getPaperImages(arxivId as string);
          setImages(imageData);
        } catch (imageError) {
          console.error('Error fetching images:', imageError);
          // Don't fail the whole page if just images fail
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load paper';
        setError(errorMsg);
        
        if (errorMsg.includes('backend') || errorMsg.includes('connect')) {
          setBackendError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPaperDetails();
  }, [arxivId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error || !paper) {
    return (
      <div className="text-center py-12 px-4">
        <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-500 mb-6">{error || 'Failed to load paper'}</p>
          
          {backendError ? (
            <>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md mb-6">
                <p className="text-yellow-700 dark:text-yellow-400">
                  The backend server doesn't appear to be running. Please start the backend server at localhost:8000 and try again.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => window.location.reload()}
                  className="btn-primary"
                >
                  Try Again
                </button>
                <Link
                  href="/"
                  className="btn-secondary"
                >
                  Return to Homepage
                </Link>
              </div>
            </>
          ) : (
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Truncate extracted text to 4000 characters
  const truncatedText = paper.extracted_text 
    ? paper.extracted_text.slice(0, 4000) + (paper.extracted_text.length > 4000 ? '...' : '') 
    : 'No extracted text available';

  return (
    <div className="pb-12">
      {/* Paper Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mb-8 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6">
            <Link 
              href="/" 
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>Back to home</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-4">{paper.title || 'Untitled Paper'}</h1>
            
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span className="inline-flex items-center bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                arXiv ID: {paper.arxiv_id}
              </span>
              
              <a 
                href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                <span>View on arXiv</span>
              </a>
              
              <a 
                href={`https://arxiv.org/pdf/${paper.arxiv_id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>
          
          {paper.authors && (
            <div className="mb-4">
              <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-1">Authors</h2>
              <p className="text-gray-800 dark:text-gray-200">{paper.authors}</p>
            </div>
          )}
          
          {paper.abstract && (
            <div className="mb-6">
              <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-1">Abstract</h2>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                {paper.abstract}
              </div>
            </div>
          )}
          
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px space-x-8">
              <button
                onClick={() => setActiveTab('text')}
                className={`py-2 flex items-center border-b-2 font-medium text-sm ${
                  activeTab === 'text' 
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4 mr-2" />
                <span>Paper Text</span>
              </button>
              
              <button
                onClick={() => setActiveTab('images')}
                className={`py-2 flex items-center border-b-2 font-medium text-sm ${
                  activeTab === 'images' 
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Figures & Images {images.length ? `(${images.length})` : ''}</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4">
        {/* Extracted Text */}
        {activeTab === 'text' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Extracted Text</h2>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed max-h-[800px] overflow-y-auto">
                {truncatedText}
              </pre>
            </div>
          </div>
        )}
        
        {/* Images */}
        {activeTab === 'images' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Figures & Images</h2>
            
            {images && images.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {images.map((image, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Figure {index + 1}</p>
                    </div>
                    <div className="p-4">
                      <div className="aspect-w-16 aspect-h-9 mb-2 bg-gray-100 dark:bg-gray-900 rounded">
                        <img 
                          src={`${BACKEND_URL}/image/${image.id}`}
                          alt={`Figure ${index + 1} from page ${image.page + 1}`}
                          className="object-contain w-full h-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null; 
                            target.src = '/placeholder-image.svg';
                            target.alt = 'Failed to load image';
                          }}
                        />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        From page {image.page + 1}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">No images available for this paper.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 