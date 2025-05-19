import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  try {
    // Properly access params in the App Router
    const { path } = context.params;
    const pathString = Array.isArray(path) ? path.join('/') : '';
    const url = `${API_BASE_URL}/${pathString}`;

    try {
      // Check if we're fetching an image
      if (pathString.includes('image/')) {
        const response = await axios.get(url, { 
          responseType: 'arraybuffer',
          timeout: 5000
        });
        
        return new NextResponse(response.data, {
          headers: {
            'Content-Type': response.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
      
      // Regular JSON response
      const response = await axios.get(url, { timeout: 5000 });
      return NextResponse.json(response.data);
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        // Return the actual error from the backend if available
        return NextResponse.json(
          error.response.data || { error: 'Backend server error' }, 
          { status: error.response.status }
        );
      }
      
      return NextResponse.json({ 
        error: 'Cannot connect to backend server. Please ensure the backend is running at ' + API_BASE_URL 
      }, { status: 503 });
    }
  } catch (error) {
    console.error('API proxy GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch from API' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  try {
    // Properly access params in the App Router
    const { path } = context.params;
    const pathString = Array.isArray(path) ? path.join('/') : '';
    const url = `${API_BASE_URL}/${pathString}`;
    
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    console.log(`Proxying POST request to: ${url}`);
    
    try {
      const response = await axios.post(url, body, { timeout: 60000 });
      return NextResponse.json(response.data);
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        // Return the actual error from the backend if available
        return NextResponse.json(
          error.response.data || { error: 'Backend server error' }, 
          { status: error.response.status }
        );
      }
      
      return NextResponse.json({ 
        error: 'Cannot connect to backend server. Please ensure the backend is running at ' + API_BASE_URL 
      }, { status: 503 });
    }
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json({ error: 'Failed to post to API' }, { status: 500 });
  }
} 