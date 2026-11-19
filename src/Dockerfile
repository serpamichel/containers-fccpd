FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000 3001 3002
CMD ["node", "proxy.js"]
