import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export async function HEAD(request: NextRequest) {
  try {
    // Simple ping to check if backend is up
    await axios.head(API_BASE_URL, { 
      timeout: 2000 // 2 second timeout
    });
    
    return new NextResponse(null, {
      status: 200,
    });
  } catch (error) {
    console.error('Backend status check failed:', error);
    return new NextResponse(null, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const response = await axios.get(API_BASE_URL, {
      timeout: 3000
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Backend connection failed:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(
        error.response.data || { error: 'Backend server error' }, 
        { status: error.response.status }
      );
    }
    
    return NextResponse.json(
      { error: 'Cannot connect to backend server' }, 
      { status: 503 }
    );
  }
} 