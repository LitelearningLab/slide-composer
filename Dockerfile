FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy pre-built dist folder
COPY dist ./dist

# Copy server and shared code (for reference)
COPY server ./server
COPY shared ./shared

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/index.cjs"]
