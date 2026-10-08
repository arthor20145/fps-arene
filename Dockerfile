FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# Using serve as a static file server for the HTML/JS/CSS game
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy the game files
COPY . .

# Expose the port Render assigns (or default to 3000)
EXPOSE 3000

# Start the static file server
# -l 3000: listen on port 3000 (Render/Docker will bind to 0.0.0.0 automatically)
CMD ["npx", "serve", "-s", ".", "-l", "3000"]