FROM node:20-bookworm-slim

WORKDIR /project

COPY ./package*.json .
RUN npm ci

COPY . .
