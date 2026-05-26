FROM python:3.12-slim

# Install ffmpeg and clean up apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application files
COPY . .

# Expose the application port
EXPOSE 8899

# Run the application
CMD ["python", "reclip.py"]
