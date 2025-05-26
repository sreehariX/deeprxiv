'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
      <div className="layout-container flex h-full grow flex-col">
        {/* Header */}
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#e7edf3] px-10 py-3">
          <div className="flex items-center gap-4 text-[#0e141b]">
            <div className="w-4 h-4">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_6_543)">
                  <path
                    d="M42.1739 20.1739L27.8261 5.82609C29.1366 7.13663 28.3989 10.1876 26.2002 13.7654C24.8538 15.9564 22.9595 18.3449 20.6522 20.6522C18.3449 22.9595 15.9564 24.8538 13.7654 26.2002C10.1876 28.3989 7.13663 29.1366 5.82609 27.8261L20.1739 42.1739C21.4845 43.4845 24.5355 42.7467 28.1133 40.548C30.3042 39.2016 32.6927 37.3073 35 35C37.3073 32.6927 39.2016 30.3042 40.548 28.1133C42.7467 24.5355 43.4845 21.4845 42.1739 20.1739Z"
                    fill="currentColor"
                  />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                    d="M7.24189 26.4066C7.31369 26.4411 7.64204 26.5637 8.52504 26.3738C9.59462 26.1438 11.0343 25.5311 12.7183 24.4963C14.7583 23.2426 17.0256 21.4503 19.238 19.238C21.4503 17.0256 23.2426 14.7583 24.4963 12.7183C25.5311 11.0343 26.1438 9.59463 26.3738 8.52504C26.5637 7.64204 26.4411 7.31369 26.4066 7.24189C26.345 7.21246 26.143 7.14535 25.6664 7.1918C24.9745 7.25925 23.9954 7.5498 22.7699 8.14278C20.3369 9.32007 17.3369 11.4915 14.4142 14.4142C11.4915 17.3369 9.32007 20.3369 8.14278 22.7699C7.5498 23.9954 7.25925 24.9745 7.1918 25.6664C7.14534 26.143 7.21246 26.345 7.24189 26.4066ZM29.9001 10.7285C29.4519 12.0322 28.7617 13.4172 27.9042 14.8126C26.465 17.1544 24.4686 19.6641 22.0664 22.0664C19.6641 24.4686 17.1544 26.465 14.8126 27.9042C13.4172 28.7617 12.0322 29.4519 10.7285 29.9001L21.5754 40.747C21.6001 40.7606 21.8995 40.931 22.8729 40.7217C23.9424 40.4916 25.3821 39.879 27.0661 38.8441C29.1062 37.5904 31.3734 35.7982 33.5858 33.5858C35.7982 31.3734 37.5904 29.1062 38.8441 27.0661C39.879 25.3821 40.4916 23.9425 40.7216 22.8729C40.931 21.8995 40.7606 21.6001 40.747 21.5754L29.9001 10.7285ZM29.2403 4.41187L43.5881 18.7597C44.9757 20.1473 44.9743 22.1235 44.6322 23.7139C44.2714 25.3919 43.4158 27.2666 42.252 29.1604C40.8128 31.5022 38.8165 34.012 36.4142 36.4142C34.012 38.8165 31.5022 40.8128 29.1604 42.252C27.2666 43.4158 25.3919 44.2714 23.7139 44.6322C22.1235 44.9743 20.1473 44.9757 18.7597 43.5881L4.41187 29.2403C3.29027 28.1187 3.08209 26.5973 3.21067 25.2783C3.34099 23.9415 3.8369 22.4852 4.54214 21.0277C5.96129 18.0948 8.43335 14.7382 11.5858 11.5858C14.7382 8.43335 18.0948 5.9613 21.0277 4.54214C22.4852 3.8369 23.9415 3.34099 25.2783 3.21067C26.5973 3.08209 28.1187 3.29028 29.2403 4.41187Z"
                  fill="currentColor"
                />
                </g>
                <defs>
                  <clipPath id="clip0_6_543"><rect width="48" height="48" fill="white" /></clipPath>
                </defs>
              </svg>
            </div>
            <h2 className="text-[#0e141b] text-lg font-bold leading-tight tracking-[-0.015em]">DeepRxiv</h2>
          </div>
          <div className="flex flex-1 justify-end gap-8">
            <div className="flex items-center gap-9">
              <Link href="/" className="text-[#0e141b] text-sm font-medium leading-normal">Home</Link>
              <Link href="/papers" className="text-[#0e141b] text-sm font-medium leading-normal">Papers</Link>
              <Link href="/chat" className="text-[#0e141b] text-sm font-medium leading-normal">Chat</Link>
              <a className="text-[#0e141b] text-sm font-medium leading-normal" href="#">Features</a>
              <a className="text-[#0e141b] text-sm font-medium leading-normal" href="#">Help</a>
            </div>
            <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-[#1978e5] text-slate-50 text-sm font-bold leading-normal tracking-[0.015em]">
              <span className="truncate">Get Started</span>
            </button>
          </div>
        </header>

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
    </div>
  );
}
