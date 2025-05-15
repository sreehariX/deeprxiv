'use client';

import { PaperDetail } from '../utils/api';

interface PaperHeaderProps {
  paper: PaperDetail;
}

export default function PaperHeader({ paper }: PaperHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">{paper.title || 'Loading title...'}</h1>
      
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
      
      <div className="flex items-center text-sm text-gray-500">
        <span className="mr-2">arXiv ID: {paper.arxiv_id}</span>
        <a 
          href={`https://arxiv.org/abs/${paper.arxiv_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          View on arXiv
        </a>
        <span className="mx-2">|</span>
        <a 
          href={`https://arxiv.org/pdf/${paper.arxiv_id}.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Download PDF
        </a>
      </div>
    </div>
  );
} 