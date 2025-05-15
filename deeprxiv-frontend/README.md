# DeepRxiv

DeepRxiv is an AI-powered research paper explorer that helps users understand complex academic papers by breaking them down into digestible sections and providing explanations.

## Features

- Process arXiv papers by URL
- Extract text, images, and tables from PDFs
- AI-powered analysis and breakdown of paper content
- Interactive exploration of paper sections
- View extracted figures and tables

## Project Structure

The project consists of two main components:

### Backend (FastAPI)

- PDF processing and extraction
- PostgreSQL database for storing papers and extracted content
- Integration with Gemini AI for paper analysis

### Frontend (Next.js)

- Modern UI with Tailwind CSS
- Dynamic paper viewing experience
- Interactive section exploration

## Setup Instructions

### Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL database

### Backend Setup

1. Navigate to the backend directory:
```bash
cd deeprxiv-backend
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
```bash
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create a `.env` file with the following content:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/deeprxiv
GEMINI_API_KEY=AIzaSyBCYtM1eUIJ0v2R4xLZ7sHTsOz6KhNcKv8
```

6. Create the PostgreSQL database:
```bash
# Using psql
psql -U postgres -c "CREATE DATABASE deeprxiv;"
```

7. Run the backend server:
```bash
python run.py
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd deeprxiv-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Go to the home page
2. Enter an arXiv URL (e.g., https://arxiv.org/abs/1706.03762)
3. The system will download and process the paper
4. Once processed, you'll be redirected to the paper page
5. Explore the paper sections, figures, and tables

## Technologies Used

- **Backend**:
  - FastAPI
  - SQLAlchemy
  - PyPDF2
  - OpenCV
  - Google Gemini API

- **Frontend**:
  - Next.js
  - React
  - Tailwind CSS
  - AI SDK 