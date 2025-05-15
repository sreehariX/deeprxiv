'use client';

import { useState, useEffect } from 'react';

export default function BackendStatusAlert() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showInstructions, setShowInstructions] = useState(false);
  
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch('/api/proxy', { 
          method: 'HEAD',
          // Add a short timeout to prevent long waits
          signal: AbortSignal.timeout(2000)
        });
        setBackendStatus(response.ok ? 'online' : 'offline');
      } catch (error) {
        console.error('Error checking backend status:', error);
        setBackendStatus('offline');
      }
    };
    
    checkBackendStatus();
    
    // Check every 10 seconds
    const interval = setInterval(checkBackendStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  if (backendStatus === 'checking') {
    return (
      <div className="bg-blue-50 p-2 text-sm text-blue-600 rounded-md mb-4">
        Checking backend connection...
      </div>
    );
  }
  
  if (backendStatus === 'offline') {
    return (
      <div className="bg-red-50 p-3 text-sm rounded-md mb-4">
        <p className="font-semibold text-red-600 mb-1">⚠️ Backend server is offline</p>
        <p className="text-red-700">
          The backend server at localhost:8000 is not responding. Paper processing will not work until the backend server is running.
        </p>
        
        <button 
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-blue-600 underline mt-2 text-xs"
        >
          {showInstructions ? 'Hide instructions' : 'Show instructions to start backend'}
        </button>
        
        {showInstructions && (
          <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-800 font-mono">
            <p className="font-semibold mb-1">To start the backend server:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open a terminal/command prompt</li>
              <li>Navigate to the deeprxiv-backend directory</li>
              <li>Run: <code className="bg-gray-200 px-1 py-0.5 rounded">python run.py</code></li>
              <li>Wait for the server to start (you should see "Running on http://localhost:8000")</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}
      </div>
    );
  }
  
  return null; // Don't show anything when backend is online
} 