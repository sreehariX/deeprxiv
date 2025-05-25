'use client';

import UrlInput from '../components/UrlInput';
import HealthCheckButton from '../components/HealthCheckButton';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { ArrowRight, BookOpen, FileText, Image, Terminal, Clock, ChevronRight, User, Zap, Brain, Search, TrendingUp, Users, Award, Star, Play, CheckCircle, ArrowUpRight } from 'lucide-react';

function UrlInputWrapper() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[480px] mx-auto">
        <div className="animate-pulse">
          <div className="h-14 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    }>
      <UrlInput />
    </Suspense>
  );
}

function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

function ProgressDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    "Downloading PDF...",
    "Extracting text content...",
    "Processing with AI...",
    "Generating sections...",
    "Creating interactive view..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h3 className="font-semibold text-gray-800">Live Processing Demo</h3>
      </div>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className={`flex items-center transition-all duration-500 ${
            index === currentStep ? 'text-blue-600 font-medium' : 
            index < currentStep ? 'text-green-600' : 'text-gray-400'
          }`}>
            <div className={`w-4 h-4 rounded-full mr-3 flex items-center justify-center transition-all duration-500 ${
              index === currentStep ? 'bg-blue-600' : 
              index < currentStep ? 'bg-green-600' : 'bg-gray-300'
            }`}>
              {index < currentStep ? (
                <CheckCircle className="w-3 h-3 text-white" />
              ) : index === currentStep ? (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              ) : (
                <div className="w-2 h-2 bg-white rounded-full opacity-50"></div>
              )}
            </div>
            <span className="text-sm">{step}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-2000 ease-out"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        ></div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0);
  
  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: "AI-Powered Analysis",
      description: "Advanced language models break down complex research into digestible sections"
    },
    {
      icon: <Search className="w-6 h-6" />,
      title: "Smart Search", 
      description: "Find relevant papers and sections with intelligent semantic search"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Interactive Reading",
      description: "Navigate papers with enhanced visuals, citations, and cross-references"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [features.length]);

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-white font-inter">
      <div className="layout-container flex h-full grow flex-col">
        {/* Enhanced Header */}
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#f1f2f4] px-10 py-4 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center gap-4 text-[#121417]">
            <div className="size-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[#121417] text-xl font-bold leading-tight tracking-[-0.015em]">deeprxiv</h2>
              <p className="text-xs text-[#677583]">AI Research Assistant</p>
            </div>
          </div>
          <div className="flex flex-1 justify-end gap-8">
            <div className="flex items-center gap-8">
              <Link href="/papers" className="text-[#121417] text-sm font-medium leading-normal hover:text-blue-600 transition-colors relative group">
                my papers
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </Link>
              <Link href="/papers" className="text-[#121417] text-sm font-medium leading-normal hover:text-blue-600 transition-colors relative group">
                explore papers
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </Link>
              <a className="text-[#121417] text-sm font-medium leading-normal hover:text-blue-600 transition-colors relative group" href="#">
                trending
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </a>
              <a className="text-[#121417] text-sm font-medium leading-normal hover:text-blue-600 transition-colors relative group" href="#">
                about
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </a>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full size-10 flex items-center justify-center hover:from-blue-200 hover:to-indigo-200 transition-all cursor-pointer">
              <User className="w-5 h-5 text-blue-700" />
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/50"></div>
          
          <div className="relative px-10 lg:px-40 flex flex-1 justify-center py-16">
            <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
              {/* Main Hero Content */}
              <div className="text-center mb-16">
                <div className="inline-flex items-center bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-blue-200">
                  <Zap className="w-4 h-4 mr-2" />
                  Powered by Advanced AI
                </div>
                
                <h1 className="text-[#121417] text-5xl lg:text-6xl font-bold leading-tight tracking-[-0.02em] mb-6">
                  Transform Research Papers into
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Interactive Experiences</span>
                </h1>
                
                <p className="text-[#677583] text-xl leading-relaxed mb-8 max-w-3xl mx-auto">
                  DeepRxiv uses cutting-edge AI to break down complex research papers into digestible sections, 
                  extract key insights, and create an interactive reading experience that accelerates your research workflow.
                </p>

                {/* Stats Row */}
                <div className="flex justify-center items-center gap-8 mb-12 text-center">
                  <div className="bg-white rounded-lg px-6 py-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-[#121417]">
                      <AnimatedCounter end={10000} suffix="+" />
                    </div>
                    <div className="text-sm text-[#677583]">Papers Processed</div>
                  </div>
                  <div className="bg-white rounded-lg px-6 py-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-[#121417]">
                      <AnimatedCounter end={95} suffix="%" />
                    </div>
                    <div className="text-sm text-[#677583]">Accuracy Rate</div>
                  </div>
                  <div className="bg-white rounded-lg px-6 py-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-[#121417]">
                      <AnimatedCounter end={2} suffix="min" />
                    </div>
                    <div className="text-sm text-[#677583]">Avg Processing</div>
                  </div>
                </div>

                {/* URL Input Section */}
                <div className="max-w-[600px] mx-auto mb-8">
            <UrlInputWrapper />
          </div>
          
                {/* Health Check and Demo */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <HealthCheckButton />
                  <div className="flex items-center text-[#677583] text-sm">
                    <Play className="w-4 h-4 mr-2" />
                    <span>Watch how it works</span>
          </div>
        </div>
              </div>

              {/* Live Demo Section */}
              <div className="grid lg:grid-cols-2 gap-12 mb-16">
                <div>
                  <h3 className="text-2xl font-bold text-[#121417] mb-4">See It In Action</h3>
                  <p className="text-[#677583] mb-6">
                    Watch as our AI processes a research paper in real-time, extracting key information 
                    and creating an interactive reading experience.
              </p>
                  <ProgressDemo />
            </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Brain className="w-12 h-12 text-white" />
              </div>
                    <h4 className="font-semibold text-[#121417] mb-2">AI Processing Engine</h4>
                    <p className="text-sm text-[#677583]">
                      Advanced neural networks analyze and restructure research content in real-time
              </p>
            </div>
          </div>
        </div>
      
              {/* Features Showcase */}
              <div className="mb-16">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-[#121417] mb-4">Why Researchers Choose DeepRxiv</h2>
                  <p className="text-[#677583] text-lg max-w-2xl mx-auto">
                    Powerful features designed to accelerate your research and make complex papers accessible.
            </p>
          </div>
          
                <div className="grid lg:grid-cols-3 gap-8">
                  {features.map((feature, index) => (
                    <div 
                      key={index}
                      className={`bg-white rounded-xl p-8 border transition-all duration-300 cursor-pointer ${
                        activeFeature === index 
                          ? 'border-blue-200 shadow-lg scale-105' 
                          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                      }`}
                      onMouseEnter={() => setActiveFeature(index)}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-all duration-300 ${
                        activeFeature === index 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-blue-50 text-blue-600'
                      }`}>
                        {feature.icon}
                      </div>
                      <h3 className="text-xl font-semibold text-[#121417] mb-3">{feature.title}</h3>
                      <p className="text-[#677583] leading-relaxed">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trending Papers */}
              <div className="mb-16">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-[#121417] mb-2">Trending Research</h2>
                    <p className="text-[#677583]">Discover the most impactful papers in AI and machine learning</p>
                  </div>
                  <Link href="/papers" className="flex items-center text-blue-600 hover:text-blue-700 font-medium">
                    View all papers
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  <Link href="/abs/1706.03762" className="group">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
                      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white" />
                          </div>
                          <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                            Most Cited
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mb-2">Transformer</div>
                        <div className="text-sm text-[#677583]">Neural Architecture</div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-[#121417] mb-2 group-hover:text-blue-600 transition-colors">
                          Attention Is All You Need
                        </h3>
                        <p className="text-[#677583] text-sm mb-4">
                          The groundbreaking paper that introduced the Transformer architecture, revolutionizing natural language processing.
              </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-600 font-medium">arXiv:1706.03762</span>
                          <div className="flex items-center text-[#677583] text-xs">
                            <Star className="w-3 h-3 mr-1 fill-current text-yellow-400" />
                            <span>50k+ citations</span>
                          </div>
                        </div>
                      </div>
              </div>
            </Link>
            
                  <Link href="/abs/1512.03385" className="group">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
                      <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 p-8">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                            <Image className="w-6 h-6 text-white" />
                          </div>
                          <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                            Computer Vision
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mb-2">ResNet</div>
                        <div className="text-sm text-[#677583]">Deep Learning</div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-[#121417] mb-2 group-hover:text-blue-600 transition-colors">
                          Deep Residual Learning for Image Recognition
                        </h3>
                        <p className="text-[#677583] text-sm mb-4">
                          Introducing ResNet architecture with skip connections that enabled training of very deep neural networks.
              </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-600 font-medium">arXiv:1512.03385</span>
                          <div className="flex items-center text-[#677583] text-xs">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            <span>Trending</span>
                          </div>
                        </div>
                      </div>
              </div>
            </Link>
            
                  <Link href="/abs/2505.15820" className="group">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
                      <div className="relative bg-gradient-to-br from-purple-50 to-violet-50 p-8">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                            <Terminal className="w-6 h-6 text-white" />
                          </div>
                          <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                            Latest Research
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-purple-600 mb-2">ML Advances</div>
                        <div className="text-sm text-[#677583]">Machine Learning</div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-[#121417] mb-2 group-hover:text-blue-600 transition-colors">
                          Recent Advances in Machine Learning
                        </h3>
                        <p className="text-[#677583] text-sm mb-4">
                          An overview of the latest trends and developments in machine learning and AI applications.
              </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-600 font-medium">arXiv:2505.15820</span>
                          <div className="flex items-center text-[#677583] text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            <span>2 days ago</span>
                          </div>
                        </div>
                      </div>
              </div>
            </Link>
          </div>
        </div>
      
              {/* How it Works */}
              <div className="mb-16">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-[#121417] mb-4">How DeepRxiv Works</h2>
                  <p className="text-[#677583] text-lg max-w-2xl mx-auto">
                    Our AI-powered pipeline transforms complex research papers into accessible, interactive experiences.
            </p>
          </div>
          
                <div className="grid lg:grid-cols-4 gap-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg">
                1
              </div>
                    <h3 className="font-bold text-[#121417] mb-2">Submit Paper URL</h3>
                    <p className="text-sm text-[#677583]">
                      Paste any arXiv paper URL and our system begins processing immediately
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg">
                      2
                    </div>
                    <h3 className="font-bold text-[#121417] mb-2">AI Analysis</h3>
                    <p className="text-sm text-[#677583]">
                      Advanced language models extract key concepts, figures, and structure the content
                </p>
              </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg">
                      3
                    </div>
                    <h3 className="font-bold text-[#121417] mb-2">Smart Sectioning</h3>
                    <p className="text-sm text-[#677583]">
                      Content is organized into logical sections with enhanced readability
                    </p>
            </div>
            
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg">
                      4
              </div>
                    <h3 className="font-bold text-[#121417] mb-2">Interactive Experience</h3>
                    <p className="text-sm text-[#677583]">
                      Browse with enhanced visuals, citations, and cross-references
                </p>
              </div>
            </div>
              </div>

              {/* Testimonial */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-12 text-center border border-blue-100">
                <div className="flex justify-center items-center gap-2 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current text-yellow-400" />
                  ))}
                  <span className="text-[#677583] ml-2">Trusted by 10,000+ researchers</span>
                </div>
                <h3 className="text-2xl font-bold text-[#121417] mb-4">
                  "DeepRxiv has revolutionized how I consume research papers"
                </h3>
                <p className="text-[#677583] text-lg mb-6 max-w-2xl mx-auto">
                  "What used to take hours of reading and note-taking now takes minutes. 
                  The AI-generated sections help me quickly understand the key contributions and methodology."
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-[#121417]">Dr. Sarah Chen</div>
                    <div className="text-sm text-[#677583]">AI Researcher, Stanford University</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
      </div>
    </div>
  );
}
