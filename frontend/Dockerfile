FROM node:22-alpine

WORKDIR /app

# Variables de entorno inyectadas durante la compilación de Vite
ARG VITE_BACKEND_URL=https://ropetx-backend-450227135111.us-central1.run.app
ARG VITE_WS_BACKEND_URL=wss://ropetx-backend-450227135111.us-central1.run.app
ARG VITE_ADMIN_TOKEN=AdminSecret2026

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_WS_BACKEND_URL=$VITE_WS_BACKEND_URL
ENV VITE_ADMIN_TOKEN=$VITE_ADMIN_TOKEN

COPY package*.json ./
RUN npm install --no-audit

COPY . .
RUN npm run build

EXPOSE 5173 8080

CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port ${PORT:-5173}"]
