'use client';

import { useState } from 'react';
import { Section } from '../utils/api';
import MarkdownRenderer from './MarkdownRenderer';
import { ChevronDown } from 'lucide-react';

interface PaperSectionProps {
  section: Section;
  isActive?: boolean;
  onSelect?: () => void;
}

export default function PaperSection({ section, isActive = false, onSelect }: PaperSectionProps) {
  const [expanded, setExpanded] = useState(isActive);
  
  const handleToggle = () => {
    if (onSelect && !expanded) {
      onSelect();
    }
    setExpanded(!expanded);
  };
  
  return (
    <div 
      className={`border border-gray-700 rounded-md mb-4 overflow-hidden transition-shadow ${
        expanded ? 'shadow-md bg-gray-800/50' : ''
      }`}
    >
      <button
        className="w-full px-4 py-3 text-left bg-gray-800 hover:bg-gray-700 flex justify-between items-center"
        onClick={handleToggle}
      >
        <h3 className="text-lg font-medium text-gray-100">{section.title}</h3>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'transform rotate-180' : ''}`}
        />
      </button>
      
      {expanded && (
        <div className="p-4">
          <MarkdownRenderer 
            content={section.content} 
            sourcePageNumber={section.page_number}
          />
          
          {section.subsections && section.subsections.length > 0 && (
            <div className="mt-8 space-y-6">
              {section.subsections.map((subsection) => (
                <div key={subsection.id} className="border-t border-gray-700 pt-4">
                  <h4 className="text-lg font-medium mb-3 text-gray-200">{subsection.title}</h4>
                  <MarkdownRenderer 
                    content={subsection.content} 
                    sourcePageNumber={subsection.page_number}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 