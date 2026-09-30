FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8080 \
    GOLF_DATA_DIR=/data

WORKDIR /app
COPY server.py ./
COPY static ./static

EXPOSE 8080
CMD ["python3", "server.py"]
