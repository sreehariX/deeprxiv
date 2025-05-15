'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProcessedPapers, Paper } from '../../utils/api';
import LoadingState from '../../components/LoadingState';

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
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">No Papers Yet</h1>
        <p className="text-gray-600 mb-6">Process your first paper to get started.</p>
        <Link 
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="text-3xl font-bold mb-8">Processed Papers</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {papers.map((paper) => (
          <Link 
            key={paper.arxiv_id}
            href={`/abs/${paper.arxiv_id}`}
            className="block border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <h2 className="font-bold text-lg mb-2 line-clamp-2">{paper.title || 'Untitled Paper'}</h2>
            {paper.authors && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-1">{paper.authors}</p>
            )}
            {paper.abstract && (
              <p className="text-sm text-gray-700 line-clamp-3">{paper.abstract}</p>
            )}
            <div className="mt-4 text-sm text-blue-600">
              arXiv:{paper.arxiv_id}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
} 