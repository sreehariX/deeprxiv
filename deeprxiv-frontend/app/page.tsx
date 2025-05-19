import UrlInput from '../components/UrlInput';
import HealthCheckButton from '../components/HealthCheckButton';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileText, Image, Terminal, Clock } from 'lucide-react';

// Add Papers List component
import PapersList from '../components/PapersList';

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 flex flex-col items-center text-center">
        <div className="container px-4 md:px-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              DeepRxiv
            </h1>
            <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
              Explore and understand research papers with AI assistance
            </p>
          </div>
          
          <div className="w-full max-w-3xl mx-auto mt-12 mb-8">
        <UrlInput />
      </div>
      
          <div className="w-full max-w-md mx-auto">
            <HealthCheckButton />
          </div>
        </div>
      </section>

      {/* Papers List Section */}
      <section className="w-full py-8 md:py-12">
        <div className="container px-4 md:px-6 max-w-6xl mx-auto">
          <PapersList />
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 bg-gray-50 dark:bg-gray-800/50">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">Text Extraction</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Extract and analyze text from arXiv PDFs with sophisticated processing.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
                <Image className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">Image Recognition</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Extract figures, diagrams, and other images from research papers.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
                <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">Simplified Reading</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Read academic papers in a clean, easily digestible format with useful metadata.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Example Paper Section */}
      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              Try with a Popular Paper
            </h2>
            <p className="max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
              Explore a famous machine learning paper to see DeepRxiv in action
            </p>
          </div>
          
          <div className="grid gap-6 mt-8 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/abs/1706.03762" className="paper-card group">
              <h3 className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Attention Is All You Need</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Pioneering paper introducing the Transformer architecture
              </p>
              <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400">
                <span className="text-sm font-medium">View Paper</span>
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
            
            <Link href="/abs/1609.04747" className="paper-card group">
              <h3 className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Deep Residual Learning for Image Recognition</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Introducing ResNet architecture with skip connections
              </p>
              <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400">
                <span className="text-sm font-medium">View Paper</span>
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
            
            <Link href="/abs/1711.10957" className="paper-card group">
              <h3 className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">NICE: Non-linear Independent Components Estimation</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Foundational paper for generative flow models
              </p>
              <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400">
                <span className="text-sm font-medium">View Paper</span>
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </section>
      
      {/* How it Works Section */}
      <section className="w-full py-12 md:py-24 bg-gray-50 dark:bg-gray-800/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              How It Works
            </h2>
            <p className="max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
              DeepRxiv makes research papers more accessible in just a few steps
            </p>
          </div>
          
          <div className="grid gap-6 mt-8 md:grid-cols-1 lg:grid-cols-3">
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                1
              </div>
              <div>
                <h3 className="font-bold">Enter an arXiv URL</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Paste any arXiv paper URL (e.g., https://arxiv.org/abs/1706.03762)
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                2
              </div>
              <div>
                <h3 className="font-bold">Backend Processing</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Our system extracts and structures the paper's content
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                3
              </div>
              <div>
                <h3 className="font-bold">Explore Results</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Browse the paper with enhanced visuals and extracted content
                </p>
              </div>
            </div>
          </div>
      </div>
      </section>
    </div>
  );
}
