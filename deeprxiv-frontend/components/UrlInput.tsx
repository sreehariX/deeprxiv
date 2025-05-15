'use client';

import { useState } from 'react';
import { processArxivURL, extractArxivId } from '../utils/api';
import { useRouter } from 'next/navigation';

export default function UrlInput() {
  const [url, setUrl] = useState('https://arxiv.org/abs/1706.03762');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate URL format
    const arxivId = extractArxivId(url);
    if (!arxivId) {
      setError('Please enter a valid arXiv URL (e.g., https://arxiv.org/abs/1706.03762)');
      return;
    }
    
    setLoading(true);
    setStartTime(Date.now());
    setProcessingTime(null);
    
    try {
      await processArxivURL(url);
      // Calculate processing time
      const endTime = Date.now();
      setProcessingTime(endTime - (startTime || endTime));
      
      // Redirect to the paper page
      setTimeout(() => {
        router.push(`/abs/${arxivId}`);
      }, 1000); // Small delay to show processing time
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'An error occurred while processing the URL';
      
      // Check if it's a backend connection error
      if (errorMessage.includes('Cannot connect to backend server')) {
        errorMessage = 'Cannot connect to backend server. Please make sure the backend is running at http://localhost:8000.';
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend server. Please make sure the backend is running at http://localhost:8000.';
      }
      
      setError(errorMessage);
      setLoading(false);
      setProcessingTime(null);
    }
  };

  // Function to handle opening the paper directly without processing
  const handleViewDirect = () => {
    const arxivId = extractArxivId(url);
    if (arxivId) {
      router.push(`/abs/${arxivId}`);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter arXiv URL (e.g., https://arxiv.org/abs/1706.03762)"
            className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            className={`px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Process'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-red-500 text-sm">{error}</p>
            {error.includes('backend') && (
              <div className="mt-2">
                <p className="text-sm text-gray-700">
                  You can still view the paper page, but processing features may not work:
                </p>
                <button 
                  type="button"
                  onClick={handleViewDirect}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  View paper page anyway
                </button>
              </div>
            )}
          </div>
        )}
        
        {loading && (
          <div className="bg-blue-50 p-4 rounded-md">
            <div className="flex items-center">
              <div className="w-4 h-4 border-t-2 border-blue-500 border-solid rounded-full animate-spin mr-2"></div>
              <p className="text-blue-600">Processing paper... Please wait</p>
            </div>
            {startTime && (
              <p className="text-xs text-blue-500 mt-1">
                Processing for {Math.floor((Date.now() - startTime) / 1000)} seconds
              </p>
            )}
          </div>
        )}
        
        {processingTime && !loading && (
          <div className="bg-green-50 p-4 rounded-md">
            <p className="text-green-600">Processing complete! Redirecting to paper...</p>
            <p className="text-xs text-green-500 mt-1">
              Processed in {(processingTime / 1000).toFixed(2)} seconds
            </p>
          </div>
        )}
      </form>
    </div>
  );
} 