FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Copy Prisma schema from root project
COPY schema.prisma ./

# Install dependencies with Bun
RUN bun install --production

# Generate Prisma client
RUN bunx prisma generate

# Copy application code
COPY server.js ./

# Expose Socket.io port
EXPOSE 3002

# Start Socket.io server with Bun
CMD ["bun", "run", "server.js"]
