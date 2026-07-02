FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV TELEMETRY_UDP_PORT=9999 \
    DATA_DIR=/app/data

EXPOSE 8000/tcp 9999/udp

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
