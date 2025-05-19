'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProcessedPapers, Paper } from '../../utils/api';
import LoadingState from '../../components/LoadingState';
import { ArrowLeft, ArrowRight, CheckCircle, Clock } from 'lucide-react';

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const data = await getProcessedPapers();
        setPapers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load papers');
      } finally {
        setLoading(false);
      }
    };

    fetchPapers();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-6 flex items-center">
        <Link 
          href="/" 
          className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Home</span>
        </Link>
        <h1 className="text-3xl font-bold">Processed Papers</h1>
      </div>
      
      {papers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">No Papers Yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Process your first paper to get started.</p>
          <Link 
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Input Form
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {papers.map((paper) => (
            <Link 
              key={paper.arxiv_id}
              href={`/abs/${paper.arxiv_id}`}
              className="block border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
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
              
              <h2 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">{paper.title || 'Untitled Paper'}</h2>
              
              {paper.authors && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-1">{paper.authors}</p>
              )}
              
              {paper.abstract && (
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{paper.abstract}</p>
              )}
              
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  arXiv:{paper.arxiv_id}
                </div>
                <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <span className="text-sm font-medium">View</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 