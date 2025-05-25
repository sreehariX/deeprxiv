'use client';

import { useState } from 'react';
import axios from 'axios';
import { ActivitySquare, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

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
        className={`flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 text-sm font-bold leading-normal tracking-[0.015em] transition-colors ${
          status === 'idle' 
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' 
            : status === 'checking'
            ? 'bg-blue-100 text-blue-700 cursor-wait'
            : status === 'online'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
        disabled={status === 'checking'}
      >
        {status === 'idle' && (
          <>
            <ActivitySquare className="w-4 h-4 mr-2" />
            <span className="truncate">Check Backend Status</span>
          </>
        )}
        
        {status === 'checking' && (
          <>
            <div className="w-4 h-4 border-t-2 border-b-2 border-current rounded-full animate-spin mr-2"></div>
            <span className="truncate">Checking Status...</span>
          </>
        )}
        
        {status === 'online' && (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            <span className="truncate">Backend Online</span>
          </>
        )}
        
        {status === 'offline' && (
          <>
            <XCircle className="w-4 h-4 mr-2" />
            <span className="truncate">Backend Offline</span>
          </>
        )}
      </button>
      
      {status !== 'idle' && (
        <div className={`mt-4 p-4 rounded-lg border w-full ${
          status === 'checking' 
            ? 'bg-blue-50 border-blue-200' 
            : status === 'online'
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          {status === 'checking' && (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-t-2 border-blue-500 border-solid rounded-full animate-spin mr-2"></div>
              <p className="text-blue-600">Checking backend status...</p>
            </div>
          )}
          
          {status === 'online' && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-green-600 font-semibold text-lg">Backend is online!</p>
              {responseTime && (
                <div className="inline-flex items-center justify-center bg-green-100 px-2.5 py-0.5 rounded-full text-sm font-medium text-green-800 mt-2">
                  Response time: {responseTime}ms
                </div>
              )}
            </div>
          )}
          
          {status === 'offline' && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-600 font-semibold text-lg mb-2">Backend is offline</p>
              <p className="text-red-500 text-sm mb-4">
                Unable to connect to backend at http://127.0.0.1:8000/api
              </p>
              <div className="bg-white rounded-lg p-4 text-xs text-gray-800 font-mono">
                <p className="font-semibold mb-2">To start the backend server:</p>
                <ol className="list-decimal pl-5 space-y-1 text-left">
                  <li>Open a terminal/command prompt</li>
                  <li>Navigate to the deeprxiv-backend directory</li>
                  <li>Run: <code className="bg-gray-100 px-1.5 py-0.5 rounded">python run.py</code></li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 