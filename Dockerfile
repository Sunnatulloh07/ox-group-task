FROM node:20-slim AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "run", "start:dev"]