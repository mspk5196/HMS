# ─── Build Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Build argument for frontend API URL
ARG VITE_API_URL="https://neha.tylo.co.in/api"
ENV VITE_API_URL=$VITE_API_URL

# Copy project files and build
COPY . .
RUN npm run build

# ─── Production Stage ────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
