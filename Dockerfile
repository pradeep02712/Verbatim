# Base image for Node.js and Python environment
FROM node:18-bullseye AS node-base

# Install Python 3.9 for WhisperX
RUN apt-get update

# Set the working directory and copy code
WORKDIR /app
COPY . .

# Install Package dependencies
RUN xargs -a setup/packages.txt -r apt-get install -y

# Setup Python and pip
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* 

# Copy Node.js dependencies
# RUN npm --prefix setup/ install
RUN npm install -g node-pre-gyp
RUN npm install wrtc ws child_process winston

# Copy Python dependencies
RUN pip install -r setup/pip_requirements_1.txt
RUN pip install -r setup/pip_requirements_2.txt

# Expose necessary ports
EXPOSE 3010

# Start the Node.js server
CMD ["node", "server/server.js"]
