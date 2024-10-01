FROM node:20

ENV PORT 3000

WORKDIR /app

COPY . .

RUN npm install --production

CMD [ "node", "server/index.js" ]
