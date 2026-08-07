FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src
RUN mkdir -p uploads/evidence

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "src/server.js"]
