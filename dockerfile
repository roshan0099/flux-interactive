FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=base /app/dist ./dist

CMD ["serve", "-l", "5172", "-s", "dist"]
