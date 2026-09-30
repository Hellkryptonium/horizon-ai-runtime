FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/huggingface

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "from transformers import pipeline; pipeline('sentiment-analysis', model='distilbert-base-uncased-finetuned-sst-2-english', device=-1)"
COPY app.py .

EXPOSE 8000
USER 10001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
