// API utility functions for interacting with the backend
import axios from 'axios';

const API_BASE_URL = '/api/proxy';

export interface Paper {
  arxiv_id: string;
  title?: string;
  authors?: string;
  abstract?: string;
  processed: boolean;
}

export interface PaperDetail {
  id?: number;
  arxiv_id: string;
  title?: string;
  authors?: string;
  abstract?: string;
  pdf_url?: string;
  extracted_text?: string;
  images?: Image[];
  processed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Section {
  heading: string;
  summary: string;
  key_points: string[];
}

export interface Image {
  id: string;
  page: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Table {
  id: string;
  page: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  image_path: string;
  text: string;
}

// Process an arXiv URL
export async function processArxivURL(url: string): Promise<Paper> {
  try {
    const response = await axios.post(`${API_BASE_URL}/process`, { url }, {
      timeout: 30000, // 30 second timeout
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(error.response.data.detail || 'Failed to process arXiv URL');
      } else if (error.request) {
        throw new Error('Cannot connect to backend server. Please ensure the backend is running.');
      }
    }
    throw new Error('An error occurred while processing the URL');
  }
}

// Get paper details by arXiv ID
export async function getPaperDetails(arxivId: string): Promise<PaperDetail> {
  try {
    const response = await axios.get(`${API_BASE_URL}/paper/${arxivId}`, {
      timeout: 10000, // 10 second timeout
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(error.response.data.detail || 'Failed to get paper details');
      } else if (error.request) {
        throw new Error('Cannot connect to backend server. Please ensure the backend is running.');
      }
    }
    throw new Error('Failed to get paper details');
  }
}

// Get paper images by arXiv ID
export async function getPaperImages(arxivId: string): Promise<Image[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/images/${arxivId}`, {
      timeout: 10000, // 10 second timeout
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(error.response.data.detail || 'Failed to get paper images');
      } else if (error.request) {
        throw new Error('Cannot connect to backend server. Please ensure the backend is running.');
      }
    }
    throw new Error('Failed to get paper images');
  }
}

// Get processing status of a paper
export async function getProcessingStatus(arxivId: string): Promise<{ arxiv_id: string; processed: boolean }> {
  const response = await fetch(`${API_BASE_URL}/status/${arxivId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get processing status');
  }

  return response.json();
}

// Get list of all processed papers
export async function getProcessedPapers(): Promise<Paper[]> {
  const response = await fetch(`${API_BASE_URL}/papers`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get processed papers');
  }

  return response.json();
}

// Extract arXiv ID from URL
export function extractArxivId(url: string): string | null {
  const pattern = /arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/;
  const match = url.match(pattern);
  return match ? match[1] : null;
} 