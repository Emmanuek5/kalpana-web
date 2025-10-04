FROM node:20-alpine

# Install build dependencies for isolated-vm
RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy server code
COPY server.js ./

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Run server
CMD ["node", "server.js"]
