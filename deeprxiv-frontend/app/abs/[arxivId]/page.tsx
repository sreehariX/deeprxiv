'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPaperDetails, getPaperImages, PaperDetail, Image } from '../../../utils/api';
import LoadingState from '../../../components/LoadingState';
import Link from 'next/link';

// Backend URL for images
const BACKEND_URL = 'http://127.0.0.1:8000/api';

export default function PaperPage() {
  const { arxivId } = useParams();
  const router = useRouter();
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState(false);

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
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-500 mb-6">{error || 'Failed to load paper'}</p>
        
        {backendError ? (
          <>
            <div className="bg-yellow-50 p-4 rounded-md mb-6 max-w-md mx-auto">
              <p className="text-yellow-700">
                The backend server doesn't appear to be running. Please start the backend server at localhost:8000 and try again.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Return to Homepage
              </Link>
            </div>
          </>
        ) : (
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // Truncate extracted text to 4000 characters
  const truncatedText = paper.extracted_text 
    ? paper.extracted_text.slice(0, 4000) + (paper.extracted_text.length > 4000 ? '...' : '') 
    : 'No extracted text available';

  return (
    <div className="py-6 max-w-4xl mx-auto px-4">
      {/* Paper Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">{paper.title || 'Untitled Paper'}</h1>
        
        {paper.authors && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Authors</h2>
            <p className="text-gray-800">{paper.authors}</p>
          </div>
        )}
        
        {paper.abstract && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Abstract</h2>
            <p className="text-gray-800 text-sm leading-relaxed">{paper.abstract}</p>
          </div>
        )}
        
        <div className="flex flex-wrap items-center text-sm text-gray-500 gap-2">
          <span>arXiv ID: {paper.arxiv_id}</span>
          <a 
            href={`https://arxiv.org/abs/${paper.arxiv_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View on arXiv
          </a>
          <span>|</span>
          <a 
            href={`https://arxiv.org/pdf/${paper.arxiv_id}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Download PDF
          </a>
          <span>|</span>
          <Link
            href="/"
            className="text-blue-600 hover:underline"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
      
      {/* Extracted Text */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Extracted Text</h2>
        <div className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono">
          {truncatedText}
        </div>
      </div>
      
      {/* Images */}
      {images && images.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Figures & Images</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {images.map((image, index) => (
              <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="mb-2">
                  <img 
                    src={`${BACKEND_URL}/image/${image.id}`}
                    alt={`Figure ${index + 1} from page ${image.page + 1}`}
                    className="w-full h-auto object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null; 
                      target.src = '/placeholder-image.svg';
                      target.alt = 'Failed to load image';
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600">Figure {index + 1} from page {image.page + 1}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Figures & Images</h2>
          <p className="text-gray-600">No images available for this paper.</p>
        </div>
      )}
    </div>
  );
} 