import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const { id: imageId } = await params;
    
    // Forward the request to the backend
    const backendResponse = await fetch(`http://127.0.0.1:8000/api/image/${imageId}`);

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: backendResponse.status }
      );
    }

    // Get the image data and content type
    const imageBuffer = await backendResponse.arrayBuffer();
    const contentType = backendResponse.headers.get('content-type') || 'image/png';
    
    // Return the image data with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
} 