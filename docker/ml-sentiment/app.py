import os
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import pipeline

MODEL_ID = os.getenv("MODEL_ID", "distilbert-base-uncased-finetuned-sst-2-english")
app = FastAPI(title="Horizon ML Sentiment Runtime", version="0.1.0")


class PredictionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@lru_cache(maxsize=1)
def classifier():
    return pipeline("sentiment-analysis", model=MODEL_ID, device=-1)


@app.get("/health")
def health():
    try:
        classifier()
        return {"status": "ok", "model": MODEL_ID}
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"Model is not ready: {error}") from error


@app.get("/metadata")
def metadata():
    return {"model": MODEL_ID, "runtime": "docker-fastapi", "task": "sentiment-analysis"}


@app.post("/predict")
def predict(request: PredictionRequest):
    try:
        result = classifier()(request.text, truncation=True)[0]
        return {"label": result["label"], "score": float(result["score"])}
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {error}") from error
