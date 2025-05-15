import UrlInput from '../components/UrlInput';
import HealthCheckButton from '../components/HealthCheckButton';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h1 className="text-4xl font-bold mb-2 text-center">DeepRxiv</h1>
      <p className="text-xl text-gray-600 mb-8 text-center">AI-Powered Research Paper Explorer</p>
      
      <div className="w-full max-w-3xl mb-8">
        <UrlInput />
      </div>
      
      <div className="w-full max-w-md mb-8">
        <HealthCheckButton />
      </div>
      
      <div className="max-w-2xl text-center">
        <p className="text-gray-600">
          Enter an arXiv URL (e.g., https://arxiv.org/abs/1706.03762) to process and explore the paper.
        </p>
      </div>
    </div>
  );
}
