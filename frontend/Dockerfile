FROM node:22-alpine

WORKDIR /app

# Speed up npm using chsrc (best-effort)
RUN apk add --no-cache curl bash \
  && curl -fsSL https://gitee.com/RubyMetric/chsrc/raw/main/chsrc -o /usr/local/bin/chsrc \
  && chmod +x /usr/local/bin/chsrc \
  && (chsrc set npm || true)

COPY package.json package-lock.json* /app/
RUN npm install

COPY . /app

EXPOSE 5173

CMD ["npm", "run", "dev"]
