# Use official Node.js runtime as a base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for better caching)
COPY package*.json ./

# Install dependencies (production only, reproducible)
RUN corepack enable && yarn install --production

# Copy the rest of the project files
COPY . .

# Expose the app port
EXPOSE 3000

# Run the app
CMD ["node", "index.js"]