'use client';

import { useState, useEffect } from 'react';
import { processArxivUrl, getPaperStatus, extractArxivId } from '../utils/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle, Clock, Search } from 'lucide-react';

export default function UrlInput() {
  const [url, setUrl] = useState('https://arxiv.org/abs/1706.03762');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [arxivId, setArxivId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Processing paper...');
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle URL parameters on component mount
  useEffect(() => {
    const urlParam = searchParams.get('url');
    const autoProcess = searchParams.get('autoProcess');
    
    if (urlParam) {
      const decodedUrl = decodeURIComponent(urlParam);
      setUrl(decodedUrl);
      
      // If autoProcess is true, automatically start processing
      if (autoProcess === 'true') {
        setIsAutoProcessing(true);
        setTimeout(() => {
          handleSubmitWithUrl(decodedUrl);
        }, 500); // Small delay to ensure UI is ready
      }
    }
  }, [searchParams]);

  // Function to handle submit with a specific URL
  const handleSubmitWithUrl = async (targetUrl: string) => {
    setError(null);
    
    // Validate URL format
    const extractedArxivId = extractArxivId(targetUrl);
    if (!extractedArxivId) {
      setError('Please enter a valid arXiv URL (e.g., https://arxiv.org/abs/1706.03762)');
      return;
    }
    
    setLoading(true);
    setStartTime(Date.now());
    setProcessingTime(null);
    setArxivId(extractedArxivId);
    
    try {
      // Initiate paper processing
      await processArxivUrl(targetUrl);
      setStatusMessage('Processing started. This may take a few minutes...');
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
      setArxivId(null);
    }
  };

  // Effect to poll for paper status
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (loading && arxivId) {
      // Start polling for status every 5 seconds
      intervalId = setInterval(async () => {
        try {
          const status = await getPaperStatus(arxivId);
          
          if (status.processed) {
            // Paper processing is complete
            clearInterval(intervalId);
            const endTime = Date.now();
            setProcessingTime(endTime - (startTime || endTime));
            setLoading(false);
            setStatusMessage('Processing complete!');
            
            // Redirect to the paper page
            setTimeout(() => {
              router.push(`/abs/${arxivId}`);
            }, 1000);
          } else if (status.progress) {
            // Update status message if provided
            setStatusMessage(`Processing: ${status.progress}`);
          }
        } catch (err) {
          console.log('Error checking paper status:', err);
          // Don't stop polling on error, just continue
        }
      }, 5000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loading, arxivId, startTime, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmitWithUrl(url);
  };

  // Function to handle opening the paper directly without processing
  const handleViewDirect = () => {
    const id = extractArxivId(url);
    if (id) {
      router.push(`/abs/${id}`);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex max-w-[480px] flex-wrap items-end gap-4 w-full">
          <label className="flex flex-col min-w-40 flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter arXiv link"
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#121417] focus:outline-0 focus:ring-0 border border-[#dde0e4] bg-white focus:border-[#dde0e4] h-14 placeholder:text-[#677583] p-[15px] text-base font-normal leading-normal"
              disabled={loading}
            />
          </label>
        </div>
        
        <div className="flex justify-center">
          <button
            type="submit"
            className={`flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-[#357dc9] text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors hover:bg-[#2968b3] ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            <span className="truncate">{loading ? 'Processing...' : 'Process'}</span>
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-600">{error}</p>
                
                {error.includes('backend') && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600">
                      You can still view the paper page, but processing features may not work:
                    </p>
                    <button 
                      type="button"
                      onClick={handleViewDirect}
                      className="mt-2 text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="mr-3 flex-shrink-0">
                <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              </div>
              <div>
                {isAutoProcessing && (
                  <div className="mb-2">
                    <p className="text-blue-600 font-medium text-sm">
                      🚀 Auto-processing paper from URL
                    </p>
                    <p className="text-xs text-blue-500">
                      Paper wasn't found, so we're processing it automatically!
                    </p>
                  </div>
                )}
                <p className="text-blue-600 font-medium">{statusMessage}</p>
                {startTime && (
                  <div className="flex items-center mt-1">
                    <Clock className="w-4 h-4 text-blue-500 mr-1" />
                    <p className="text-xs text-blue-500">
                      Processing for {Math.floor((Date.now() - startTime) / 1000)} seconds
                    </p>
                  </div>
                )}
                <p className="text-xs text-blue-400 mt-2">
                  Note: LLM-powered section generation may take 1-2 minutes
                </p>
              </div>
            </div>
          </div>
        )}
        
        {processingTime && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
              <div>
                <p className="text-green-600 font-medium">Processing complete! Redirecting to paper...</p>
                <p className="text-xs text-green-500 mt-1">
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