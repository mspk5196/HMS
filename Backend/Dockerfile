FROM node:20-alpine

WORKDIR /app

# Install native build tools needed for packages like bcrypt
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production || npm install --omit=dev

# Copy application source code
COPY . .

# Expose backend service port
EXPOSE 5000

ENV PORT=5000 \
    NODE_ENV=production

CMD ["node", "server.js"]
