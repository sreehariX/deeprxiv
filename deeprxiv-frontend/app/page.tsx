'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/ui/navigation';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleProcess = async () => {
    if (!url.trim()) {
      setError('Please enter an arXiv URL');
      return;
    }

    // Basic URL validation
    if (!url.includes('arxiv.org')) {
      setError('Please enter a valid arXiv URL');
      return;
    }

    setIsProcessing(true);
    setError('');
    setProgress('Starting processing...');

    try {
      // Step 1: Submit the URL for processing
      const response = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to start processing');
      }

      const result = await response.json();
      const arxivId = result.arxiv_id;

      // If already processed, redirect immediately
      if (result.processed) {
        setProgress('Paper already processed! Redirecting...');
        setTimeout(() => {
          router.push(`/abs/${arxivId}`);
        }, 1000);
        return;
      }

      // Step 2: Poll for progress updates
      setProgress('Processing paper...');
      
      const pollProgress = async () => {
        try {
          const statusResponse = await fetch(`http://localhost:8000/api/paper/${arxivId}/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.processed) {
              setProgress('Processing complete! Redirecting...');
              setTimeout(() => {
                router.push(`/abs/${arxivId}`);
              }, 1000);
              return;
            }
            
            // Update progress message
            if (statusData.progress) {
              setProgress(statusData.progress);
            }
            
            // Continue polling
            setTimeout(pollProgress, 2000);
          } else {
            // If status endpoint fails, try a few more times then redirect
            setTimeout(() => {
              router.push(`/abs/${arxivId}`);
            }, 3000);
          }
        } catch (error) {
          console.error('Error polling status:', error);
          // On error, try to redirect anyway
          setTimeout(() => {
            router.push(`/abs/${arxivId}`);
          }, 3000);
        }
      };

      // Start polling after a short delay
      setTimeout(pollProgress, 2000);

    } catch (error) {
      console.error('Error processing URL:', error);
      setError('Failed to process the paper. Please try again.');
      setIsProcessing(false);
      setProgress('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) {
      handleProcess();
    }
  };

  return (
    <div className="relative flex w-full h-full min-h-screen flex-col bg-slate-50">
      <Navigation />

      {/* Main Content */}
      <div className="px-40 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
          {/* Hero Section */}
          <div className="container">
            <div className="sm:p-4">
              <div className="flex min-h-[480px] flex-col gap-6 sm:gap-8 sm:rounded-xl items-center justify-center p-4">
                <div className="flex flex-col gap-2 text-center">
                  <h1 className="text-gray-900 text-4xl font-black leading-tight tracking-[-0.033em] sm:text-5xl sm:font-black sm:leading-tight sm:tracking-[-0.033em]">
                    Transform Research Papers with AI
                  </h1>
                  <h2 className="text-gray-700 text-sm font-normal leading-normal sm:text-base sm:font-normal sm:leading-normal">
                    DeepRxiv uses advanced AI to break down complex research papers into digestible, interactive sections.
                  </h2>
                </div>
                
                {/* URL Input */}
                <div className="flex flex-col min-w-40 h-14 w-full max-w-[480px] sm:h-16">
                  <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                    <div className="text-[#4e7097] flex border border-[#d0dbe7] bg-slate-50 items-center justify-center pl-[15px] rounded-l-xl border-r-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      placeholder="Enter arXiv URL (e.g., https://arxiv.org/abs/1706.03762)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isProcessing}
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#0e141b] focus:outline-0 focus:ring-0 border border-[#d0dbe7] bg-slate-50 focus:border-[#d0dbe7] h-full placeholder:text-[#4e7097] px-[15px] rounded-r-none border-r-0 pr-2 rounded-l-none border-l-0 pl-2 text-sm font-normal leading-normal sm:text-base sm:font-normal sm:leading-normal disabled:opacity-50"
                    />
                    <div className="flex items-center justify-center rounded-r-xl border-l-0 border border-[#d0dbe7] bg-slate-50 pr-[7px]">
                      <button 
                        onClick={handleProcess}
                        disabled={isProcessing}
                        className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 sm:h-12 sm:px-5 bg-[#1978e5] text-slate-50 text-sm font-bold leading-normal tracking-[0.015em] sm:text-base sm:font-bold sm:leading-normal sm:tracking-[0.015em] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="truncate">
                          {isProcessing ? 'Processing...' : 'Process'}
                        </span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress/Error Messages */}
                  {(progress || error) && (
                    <div className="mt-3 text-center">
                      {error && (
                        <p className="text-red-600 text-sm">{error}</p>
                      )}
                      {progress && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <p className="text-blue-600 text-sm">{progress}</p>
                          </div>
                          <div className="w-full max-w-md bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="flex flex-col gap-10 px-4 py-10">
            <div className="flex flex-col gap-4">
              <h1 className="text-[#0e141b] tracking-tight text-[32px] font-bold leading-tight sm:text-4xl sm:font-black sm:leading-tight sm:tracking-[-0.033em] max-w-[720px]">
                Streamline Your Research Process
              </h1>
              <p className="text-[#0e141b] text-base font-normal leading-normal max-w-[720px]">
                DeepRxiv offers a suite of AI-powered tools designed to enhance every stage of your research journey.
              </p>
            </div>
            
            <div className="grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-3 p-0">
              <div className="flex flex-1 gap-3 rounded-lg border border-[#d0dbe7] bg-slate-50 p-4 flex-col">
                <div className="text-[#0e141b]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[#0e141b] text-base font-bold leading-tight">Effortless Paper Processing</h2>
                  <p className="text-[#4e7097] text-sm font-normal leading-normal">Quickly import and process papers from arXiv with AI-powered analysis.</p>
                </div>
              </div>
            
              <div className="flex flex-1 gap-3 rounded-lg border border-[#d0dbe7] bg-slate-50 p-4 flex-col">
                <div className="text-[#0e141b]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[#0e141b] text-base font-bold leading-tight">AI-Powered Sectioning</h2>
                  <p className="text-[#4e7097] text-sm font-normal leading-normal">Automatically break down complex papers into digestible sections.</p>
                </div>
              </div>
              
              <div className="flex flex-1 gap-3 rounded-lg border border-[#d0dbe7] bg-slate-50 p-4 flex-col">
                <div className="text-[#0e141b]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[#0e141b] text-base font-bold leading-tight">Interactive Reading</h2>
                  <p className="text-[#4e7097] text-sm font-normal leading-normal">Navigate papers with enhanced visuals, citations, and cross-references.</p>
                </div>
              </div>

              <div className="flex flex-1 gap-3 rounded-lg border border-[#d0dbe7] bg-slate-50 p-4 flex-col">
                <div className="text-[#0e141b]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[#0e141b] text-base font-bold leading-tight">Research Analytics</h2>
                  <p className="text-[#4e7097] text-sm font-normal leading-normal">Track your research progress and gain insights with detailed analytics.</p>
                </div>
              </div>
            </div>
          </div>
        
          {/* Example Papers */}
          <h2 className="text-[#0e141b] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Explore Example Papers</h2>
          <div className="flex overflow-y-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-stretch p-4 gap-3">
              
              <Link href="/abs/1706.03762" className="flex h-full flex-1 flex-col gap-4 rounded-lg min-w-60 hover:shadow-lg transition-shadow">
                <div className="w-full bg-center bg-no-repeat aspect-[3/4] bg-cover rounded-xl flex flex-col bg-gradient-to-br from-blue-100 to-blue-200 items-center justify-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="text-blue-800 font-bold text-lg">Transformer</div>
                  <div className="text-blue-600 text-sm">Neural Architecture</div>
                </div>
                <div>
                  <p className="text-[#0e141b] text-base font-medium leading-normal">Attention Is All You Need</p>
                  <p className="text-[#4e7097] text-sm font-normal leading-normal">
                    The groundbreaking paper that introduced the Transformer architecture, revolutionizing NLP.
                  </p>
                </div>
              </Link>
              
              <Link href="/abs/1512.03385" className="flex h-full flex-1 flex-col gap-4 rounded-lg min-w-60 hover:shadow-lg transition-shadow">
                <div className="w-full bg-center bg-no-repeat aspect-[3/4] bg-cover rounded-xl flex flex-col bg-gradient-to-br from-green-100 to-green-200 items-center justify-center">
                  <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="text-green-800 font-bold text-lg">ResNet</div>
                  <div className="text-green-600 text-sm">Computer Vision</div>
                </div>
                <div>
                  <p className="text-[#0e141b] text-base font-medium leading-normal">Deep Residual Learning</p>
                  <p className="text-[#4e7097] text-sm font-normal leading-normal">
                    Introducing ResNet architecture with skip connections for very deep neural networks.
                  </p>
                </div>
              </Link>
              
              <div className="flex h-full flex-1 flex-col gap-4 rounded-lg min-w-60">
                <div className="w-full bg-center bg-no-repeat aspect-[3/4] bg-cover rounded-xl flex flex-col bg-gradient-to-br from-purple-100 to-purple-200 items-center justify-center">
                  <div className="w-16 h-16 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-purple-800 font-bold text-lg">GPT</div>
                  <div className="text-purple-600 text-sm">Language Models</div>
                </div>
                <div>
                  <p className="text-[#0e141b] text-base font-medium leading-normal">Language Models are Few-Shot Learners</p>
                  <p className="text-[#4e7097] text-sm font-normal leading-normal">
                    Exploring the capabilities of large language models in few-shot learning scenarios.
                  </p>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex justify-center">
        <div className="flex max-w-[960px] flex-1 flex-col">
          <footer className="flex flex-col gap-6 px-5 py-10 text-center">
            <div className="flex flex-wrap items-center justify-center gap-6 sm:flex-row sm:justify-around">
              <a className="text-[#4e7097] text-base font-normal leading-normal min-w-40" href="#">Terms of Service</a>
              <a className="text-[#4e7097] text-base font-normal leading-normal min-w-40" href="#">Privacy Policy</a>
              <a className="text-[#4e7097] text-base font-normal leading-normal min-w-40" href="#">Contact Us</a>
            </div>
            <p className="text-[#4e7097] text-base font-normal leading-normal">© 2024 DeepRxiv. All rights reserved.</p>
          </footer>
        </div>
      </footer>
    </div>
  );
}
