#!/usr/bin/env python3

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List
import uvicorn

app = FastAPI()

class ModelInfo(BaseModel):
    name: str
    description: str
    type: str
    context_length: str
    features: List[str]

class AvailableModelsResponse(BaseModel):
    models: Dict[str, ModelInfo]

# Available Perplexity models
available_models = {
    "sonar": {
        "name": "Sonar",
        "description": "A lightweight, cost-effective search model optimized for quick, grounded answers with real-time web search.",
        "type": "Non-reasoning",
        "context_length": "128k",
        "features": ["Real-time web search", "Fast responses", "Cost effective"]
    },
    "sonar-pro": {
        "name": "Sonar Pro", 
        "description": "An advanced search model designed for complex queries, delivering deeper content understanding with enhanced citation accuracy.",
        "type": "Non-reasoning",
        "context_length": "200k",
        "features": ["2x more citations", "Advanced information retrieval", "Multi-step tasks"]
    },
    "sonar-reasoning": {
        "name": "Sonar Reasoning",
        "description": "A reasoning-focused model that applies Chain-of-Thought (CoT) reasoning for quick problem-solving and structured analysis.",
        "type": "Reasoning",
        "context_length": "128k", 
        "features": ["Chain-of-thought reasoning", "Real-time search", "Problem solving"]
    },
    "sonar-reasoning-pro": {
        "name": "Sonar Reasoning Pro",
        "description": "A high-performance reasoning model leveraging advanced multi-step CoT reasoning and enhanced information retrieval.",
        "type": "Reasoning",
        "context_length": "128k",
        "features": ["Enhanced CoT reasoning", "2x more citations", "Complex topics"]
    }
}

@app.get("/api/chat/models", response_model=AvailableModelsResponse)
async def get_available_models():
    """Get list of available Perplexity models with descriptions."""
    formatted_models = {}
    
    for model_key, model_data in available_models.items():
        formatted_models[model_key] = ModelInfo(
            name=model_data["name"],
            description=model_data["description"],
            type=model_data["type"],
            context_length=model_data["context_length"],
            features=model_data["features"]
        )
    
    return AvailableModelsResponse(models=formatted_models)

@app.get("/")
def root():
    return {"message": "Simple models test API"}

if __name__ == "__main__":
    uvicorn.run("simple_models_test:app", host="0.0.0.0", port=8001, reload=True) 