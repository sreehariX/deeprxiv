'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { AuroraBackground } from '@/components/ui/aurora-background';
import Navigation from '@/components/ui/navigation';
import { 
  Search, 
  FileText, 
  Brain, 
  Lightbulb, 
  BarChart3, 
  Sparkles,
  ArrowRight,
  Download,
  MessageCircle
} from 'lucide-react';

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12
      }
    }
  };

  const features = [
    {
      icon: FileText,
      title: "Effortless Paper Processing",
      description: "Quickly import and process papers from arXiv with AI-powered analysis.",
      color: "blue",
      delay: 0.1
    },
    {
      icon: Brain,
      title: "AI-Powered Sectioning",
      description: "Automatically break down complex papers into digestible sections.",
      color: "purple",
      delay: 0.2
    },
    {
      icon: Search,
      title: "Interactive Reading",
      description: "Navigate papers with enhanced visuals, citations, and cross-references.",
      color: "green",
      delay: 0.3
    },
    {
      icon: BarChart3,
      title: "Research Analytics",
      description: "Track your research progress and gain insights with detailed analytics.",
      color: "orange",
      delay: 0.4
    }
  ];

  const examplePapers = [
    {
      id: "1706.03762",
      title: "Attention Is All You Need",
      description: "The groundbreaking paper that introduced the Transformer architecture, revolutionizing NLP.",
      category: "Transformer",
      subcategory: "Neural Architecture",
      gradient: "from-blue-400 to-blue-600",
      icon: Brain
    },
    {
      id: "1512.03385",
      title: "Deep Residual Learning",
      description: "Introducing ResNet architecture with skip connections for very deep neural networks.",
      category: "ResNet",
      subcategory: "Computer Vision",
      gradient: "from-green-400 to-green-600",
      icon: Lightbulb
    },
    {
      id: "2005.14165",
      title: "Language Models are Few-Shot Learners",
      description: "Exploring the capabilities of large language models in few-shot learning scenarios.",
      category: "GPT",
      subcategory: "Language Models",
      gradient: "from-purple-400 to-purple-600",
      icon: MessageCircle
    }
  ];

  return (
    <div className="relative min-h-screen">
      <Navigation />

      {/* Hero Section with Aurora Background */}
      <AuroraBackground className="min-h-screen pt-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="relative flex flex-col gap-8 items-center justify-center px-4"
        >
          {/* Main Heading */}
          <motion.div 
            className="text-center space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h1 
              variants={itemVariants}
              className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-gray-900 dark:text-white"
            >
              Transform Research Papers
              <motion.span 
                className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                with AI
              </motion.span>
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed"
            >
                deeprxiv uses Perplexity's Sonar models to break down complex research papers into interactive sections and an AI-powered chatbot
            </motion.p>
          </motion.div>

          {/* Enhanced URL Input */}
          <motion.div 
            variants={itemVariants}
            className="w-full max-w-2xl mx-auto"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-2 shadow-2xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center pl-4">
                    <Search className="w-5 h-5 text-gray-500" />
                    </div>
                    <input
                      placeholder="Enter arXiv URL (e.g., https://arxiv.org/abs/1706.03762)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isProcessing}
                    className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 border-0 focus:outline-none focus:ring-0 px-4 py-4 text-base disabled:opacity-50"
                    />
                  <motion.button 
                        onClick={handleProcess}
                    disabled={isProcessing || !url.trim()}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        Process
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </div>
                    </div>
                  </div>
                  
                  {/* Progress/Error Messages */}
                  {(progress || error) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center"
              >
                      {error && (
                  <motion.div 
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg"
                  >
                    {error}
                  </motion.div>
                      )}
                      {progress && (
                  <motion.div 
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      {progress}
                          </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Link href="/chat" className="group">
              <motion.div 
                className="flex items-center gap-2 bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border border-gray-200/30 dark:border-gray-700/30 px-6 py-3 rounded-full text-gray-700 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-800/30 transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <MessageCircle className="w-4 h-4" />
                Start Chatting
              </motion.div>
            </Link>
            <Link href="/papers" className="group">
              <motion.div 
                className="flex items-center gap-2 bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border border-gray-200/30 dark:border-gray-700/30 px-6 py-3 rounded-full text-gray-700 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-800/30 transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4" />
                Browse Papers
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </AuroraBackground>

          {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Streamline Your Research Process
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                DeepRxiv offers a suite of AI-powered tools designed to enhance every stage of your research journey.
              </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: feature.delay }}
                whileHover={{ y: -5 }}
                className="group"
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 h-full">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${
                    feature.color === 'blue' ? 'from-blue-500 to-blue-600' :
                    feature.color === 'purple' ? 'from-purple-500 to-purple-600' :
                    feature.color === 'green' ? 'from-green-500 to-green-600' :
                    'from-orange-500 to-orange-600'
                  } flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
                  </div>
                </div>
      </section>

      {/* Example Papers Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Explore Example Papers
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              See how DeepRxiv transforms complex research papers into interactive, digestible content.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {examplePapers.map((paper, index) => (
              <motion.div
                key={paper.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="group"
              >
                <Link href={`/abs/${paper.id}`} className="block">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700">
                    <div className={`h-48 bg-gradient-to-br ${paper.gradient} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/10"></div>
                      <div className="relative z-10 text-center">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4 mx-auto">
                          <paper.icon className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-white font-bold text-xl mb-1">{paper.category}</h3>
                        <p className="text-white/80 text-sm">{paper.subcategory}</p>
                </div>
                      <div className="absolute top-4 right-4">
                        <Sparkles className="w-6 h-6 text-white/60 animate-float" />
                  </div>
                </div>
                    <div className="p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {paper.title}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                        {paper.description}
                      </p>
                      <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                        Read Paper
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-wrap items-center justify-center gap-8 mb-8">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Contact Us</a>
            </div>
            <p className="text-gray-400">© 2025 DeepRxiv. All rights reserved.</p>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
