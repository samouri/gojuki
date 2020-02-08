FROM node:alpine

WORKDIR /gojuki
COPY . /gojuki/


RUN apk add --no-cache libc6-compat #  see https://github.com/nodejs/docker-node#nodealpine

RUN yarn install --frozen-lockfile
RUN yarn build-ui
RUN yarn build-server

CMD node server/index.js

