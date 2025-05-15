'use client';

import { useState } from 'react';
import axios from 'axios';

export default function HealthCheckButton() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const checkHealth = async () => {
    setStatus('checking');
    setResponseTime(null);
    
    const startTime = Date.now();
    
    try {
      // Set a timeout of 5 seconds
      const response = await axios.get('http://127.0.0.1:8000/api', {
        timeout: 5000
      });
      
      const endTime = Date.now();
      setResponseTime(endTime - startTime);
      setStatus('online');
    } catch (error) {
      console.error('Health check failed:', error);
      setStatus('offline');
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={checkHealth}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={status === 'checking'}
      >
        {status === 'checking' ? 'Checking...' : 'Check Backend Health'}
      </button>
      
      {status !== 'idle' && (
        <div className={`mt-4 p-3 rounded-md w-full ${
          status === 'checking' ? 'bg-blue-50' :
          status === 'online' ? 'bg-green-50' : 'bg-red-50'
        }`}>
          {status === 'checking' && (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-t-2 border-blue-500 border-solid rounded-full animate-spin mr-2"></div>
              <p className="text-blue-600">Checking backend health...</p>
            </div>
          )}
          
          {status === 'online' && (
            <div className="text-center">
              <p className="text-green-600 font-semibold">✓ Backend is online!</p>
              {responseTime && (
                <p className="text-green-500 text-sm">
                  Response time: {responseTime}ms
                </p>
              )}
            </div>
          )}
          
          {status === 'offline' && (
            <div className="text-center">
              <p className="text-red-600 font-semibold">✗ Backend is offline</p>
              <p className="text-red-500 text-sm mt-1">
                Unable to connect to backend at http://127.0.0.1:8000/api
              </p>
              <div className="mt-3 p-3 bg-gray-100 rounded text-xs text-gray-800 font-mono">
                <p className="font-semibold mb-1">To start the backend server:</p>
                <ol className="list-decimal pl-5 space-y-1 text-left">
                  <li>Open a terminal/command prompt</li>
                  <li>Navigate to the deeprxiv-backend directory</li>
                  <li>Run: <code className="bg-gray-200 px-1 py-0.5 rounded">python run.py</code></li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 