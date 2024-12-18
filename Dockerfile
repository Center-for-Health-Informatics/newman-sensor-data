FROM node:lts-slim
USER node
RUN mkdir /home/node/app
WORKDIR /home/node/app
COPY --chown=node:node . .
RUN npm install --omit=dev
CMD [ "node", "index.js" ]
