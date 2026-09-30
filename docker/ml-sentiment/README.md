# Horizon ML Sentiment Image

Build the approved prototype image from the repository root:

```powershell
docker build -t horizon/ml-sentiment:0.1 .\docker\ml-sentiment
```

Run it locally for a direct contract check:

```powershell
docker run --rm -p 127.0.0.1:8000:8000 horizon/ml-sentiment:0.1
```

Endpoints:

- `GET http://127.0.0.1:8000/health`
- `GET http://127.0.0.1:8000/metadata`
- `POST http://127.0.0.1:8000/predict` with `{"text":"Horizon makes deploying ML services easy."}`

The worker uses this image by default. Override the approved image set with `DOCKER_APPROVED_IMAGES` as a comma-separated list on the worker, and set `DOCKER_REQUEST_TIMEOUT_MS` for lifecycle and request timeouts.
