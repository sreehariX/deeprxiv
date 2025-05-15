'use client';

import { useState } from 'react';
import { Section } from '../utils/api';

interface PaperSectionProps {
  section: Section;
}

export default function PaperSection({ section }: PaperSectionProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border border-gray-200 rounded-md mb-4 overflow-hidden">
      <button
        className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-lg font-medium">{section.heading}</h3>
        <svg
          className={`w-5 h-5 transition-transform ${expanded ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="p-4">
          <p className="text-gray-700 mb-4">{section.summary}</p>
          
          {section.key_points && section.key_points.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Key Points:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {section.key_points.map((point, index) => (
                  <li key={index} className="text-sm text-gray-700">{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 