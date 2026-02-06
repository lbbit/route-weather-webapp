FROM node:22-alpine

WORKDIR /app

# Speed up npm using chsrc (best-effort)

COPY package.json package-lock.json* /app/
RUN npm install

COPY . /app

EXPOSE 5173

CMD ["npm", "run", "dev"]
