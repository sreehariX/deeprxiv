'use client';

import { useState, useEffect } from 'react';

export default function LoadingState() {
  const [seconds, setSeconds] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prevSeconds => prevSeconds + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      <p className="mt-4 text-gray-600">Loading paper...</p>
      <p className="text-sm text-gray-500 mt-2">
        Time elapsed: {seconds} seconds
      </p>
    </div>
  );
} 