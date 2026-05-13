FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py ./

ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8787
EXPOSE 8787

CMD ["python", "-u", "main.py"]
