'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, Zap, Brain, Search, Sparkles } from 'lucide-react';

interface ModelInfo {
  name: string;
  description: string;
  type: string;
  context_length: string;
  features: string[];
}

interface AvailableModels {
  [key: string]: ModelInfo;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  className?: string;
}

const modelIcons: { [key: string]: React.ReactNode } = {
  'sonar': <Search className="w-4 h-4" />,
  'sonar-pro': <Sparkles className="w-4 h-4" />,
  'sonar-reasoning': <Brain className="w-4 h-4" />,
  'sonar-reasoning-pro': <Zap className="w-4 h-4" />
};

// Fallback models - always available even if API fails
const fallbackModels: AvailableModels = {
  'sonar': {
    name: 'Sonar',
    description: 'Fast and efficient model for general queries',
    type: 'standard',
    context_length: '127k',
    features: ['Web search', 'Real-time info', 'Fast responses']
  },
  'sonar-pro': {
    name: 'Sonar Pro',
    description: 'Enhanced model with better reasoning capabilities',
    type: 'pro',
    context_length: '127k',
    features: ['Advanced search', 'Better reasoning', 'Higher accuracy']
  },
  'sonar-reasoning': {
    name: 'Sonar Reasoning',
    description: 'Specialized model for complex reasoning tasks',
    type: 'reasoning',
    context_length: '127k',
    features: ['Chain of thought', 'Complex reasoning', 'Step-by-step analysis']
  },
  'sonar-reasoning-pro': {
    name: 'Sonar Reasoning Pro',
    description: 'Most advanced model with superior reasoning',
    type: 'reasoning-pro',
    context_length: '127k',
    features: ['Advanced reasoning', 'Chain of thought', 'Highest accuracy']
  }
};

export default function ModelSelector({ selectedModel, onModelChange, className = '' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<AvailableModels>(fallbackModels);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        setApiError(false);
        
        const response = await fetch('http://localhost:8000/api/chat/models');
        
        if (response.ok) {
          const data = await response.json();
          if (data.models && Object.keys(data.models).length > 0) {
            setModels(data.models);
            console.log('✅ Successfully loaded models from API:', Object.keys(data.models));
          } else {
            console.warn('⚠️ API returned empty models, using fallback');
            setModels(fallbackModels);
            setApiError(true);
          }
        } else {
          console.warn('⚠️ API request failed, using fallback models. Status:', response.status);
          setModels(fallbackModels);
          setApiError(true);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch models from API, using fallback:', error);
        setModels(fallbackModels);
        setApiError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const selectedModelInfo = models[selectedModel] || models['sonar'];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1 bg-gray-800 text-white rounded text-xs hover:bg-gray-700 transition-colors min-w-0"
      >
        {modelIcons[selectedModel] || modelIcons['sonar']}
        <span className="truncate">{selectedModelInfo.name}</span>
        <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-80 bg-gray-800 rounded-lg shadow-lg z-50">
          {apiError && (
            <div className="px-3 py-2 text-xs text-yellow-400 bg-gray-900 rounded-t-lg">
              ⚠️ Using offline models (API unavailable)
            </div>
          )}
          
          {Object.entries(models).map(([modelKey, modelInfo], index) => (
            <button
              key={modelKey}
              onClick={() => {
                onModelChange(modelKey);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-3 hover:bg-gray-700 transition-colors ${
                selectedModel === modelKey ? 'bg-gray-700' : ''
              } ${index === 0 && !apiError ? 'rounded-t-lg' : ''} ${
                index === Object.keys(models).length - 1 ? 'rounded-b-lg' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {modelIcons[modelKey] || modelIcons['sonar']}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{modelInfo.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-600 px-1.5 py-0.5 rounded">
                      {modelInfo.context_length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mb-2">{modelInfo.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {modelInfo.features.slice(0, 3).map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs text-gray-400 bg-gray-600 px-1.5 py-0.5 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 