'use client';

import { useState, useEffect } from 'react';
import { getPapers } from '../utils/api';
import Link from 'next/link';
import { ArrowRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function PapersList() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPapers() {
      try {
        setLoading(true);
        const data = await getPapers();
        setPapers(data);
        setError(null);
      } catch (err) {
        console.error('Error loading papers:', err);
        setError(err.message || 'Failed to load papers');
      } finally {
        setLoading(false);
      }
    }

    loadPapers();
    
    // Refresh the list every 30 seconds
    const intervalId = setInterval(loadPapers, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (loading && papers.length === 0) {
    return (
      <div className="w-full flex justify-center p-8">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
          <span className="text-gray-600 dark:text-gray-300">Loading papers...</span>
        </div>
      </div>
    );
  }

  if (error && papers.length === 0) {
    return (
      <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg my-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-600 dark:text-red-400">Failed to load papers: {error}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Make sure the backend server is running and try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Recent Papers</h2>
      
      {papers.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-6">
          No papers found. Try processing a paper using the URL input above.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {papers.map((paper) => (
            <Link 
              key={paper.arxiv_id} 
              href={`/abs/${paper.arxiv_id}`}
              className="paper-card group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow"
            >
              {/* Processing Status Badge */}
              <div className="mb-2">
                {paper.processed ? (
                  <span className="inline-flex items-center bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Processed
                  </span>
                ) : (
                  <span className="inline-flex items-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3 mr-1" />
                    Processing
                  </span>
                )}
              </div>
              
              <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
                {paper.title}
              </h3>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                {paper.authors}
              </p>
              
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-3">
                {paper.abstract || "No abstract available"}
              </p>
              
              <div className="mt-3 flex items-center text-blue-600 dark:text-blue-400">
                <span className="text-sm font-medium">View Paper</span>
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 