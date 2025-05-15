'use client';

import { useState } from 'react';
import { processArxivURL, extractArxivId } from '../utils/api';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Clock, Search } from 'lucide-react';

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
        errorMessage = 'Cannot connect to backend server. Please make sure the backend is running at http://127.0.0.1:8000.';
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend server. Please make sure the backend is running at http://127.0.0.1:8000.';
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
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter arXiv URL (e.g., https://arxiv.org/abs/1706.03762)"
            className="w-full pl-10 pr-32 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            disabled={loading}
          />
          
          <button
            type="submit"
            className={`absolute right-1 top-1 bottom-1 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md font-medium transition-colors ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Process Paper'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                
                {error.includes('backend') && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You can still view the paper page, but processing features may not work:
                    </p>
                    <button 
                      type="button"
                      onClick={handleViewDirect}
                      className="mt-2 text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md transition-colors"
                    >
                      View paper page anyway
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center">
              <div className="mr-3 flex-shrink-0">
                <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 rounded-full animate-spin"></div>
              </div>
              <div>
                <p className="text-blue-600 dark:text-blue-400 font-medium">Processing paper... Please wait</p>
                {startTime && (
                  <div className="flex items-center mt-1">
                    <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mr-1" />
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      Processing for {Math.floor((Date.now() - startTime) / 1000)} seconds
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {processingTime && !loading && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
              <div>
                <p className="text-green-600 dark:text-green-400 font-medium">Processing complete! Redirecting to paper...</p>
                <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                  Processed in {(processingTime / 1000).toFixed(2)} seconds
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
} 