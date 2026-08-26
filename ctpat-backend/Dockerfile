# Use a glibc-based image (not Alpine/musl) - musl's DNS resolver has known SRV-record lookup issues that break mongodb+srv:// URIs
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
