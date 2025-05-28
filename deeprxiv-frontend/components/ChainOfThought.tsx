'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChainOfThoughtProps {
  thinking: string;
  autoCollapse?: boolean;
}

export default function ChainOfThought({ thinking, autoCollapse = true }: ChainOfThoughtProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (autoCollapse && thinking && thinking.trim() !== '') {
      // Auto-collapse after 5 seconds, but always show initially
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [autoCollapse, thinking]);

  // Don't render if no thinking content or if it's just whitespace
  if (!thinking || thinking.trim() === '' || thinking === 'undefined' || thinking === 'null') {
    return null;
  }

  // Clean up thinking content 
  const cleanThinking = thinking.trim();

  return (
    <div className="mt-3 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-700 transition-colors"
      >
        <Brain className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-300">Chain of Thought</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-400 mr-2">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
              <div className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
                {cleanThinking}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 