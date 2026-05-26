FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV CLIENT_DATA_PATH=/data
ENV CLIENT_DISPLAY_PORT=3000
ENV DISPLAY_DIST_PATH=/app/dist/display

EXPOSE 3000

CMD ["npm", "start"]

