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
CMD ["npx", "serve", "-s", ".", "-l", "0.0.0.0:3000"]