# Build the frontend and backend into a single production image

# --- Frontend build stage ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# --- Backend build stage ---
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ .

# Copy frontend assets into the backend app for production hosting
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-builder /app/backend .
EXPOSE 5000
CMD ["node", "app.js"]
