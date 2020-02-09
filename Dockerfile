FROM node:slim

WORKDIR /gojuki
COPY . /gojuki/


RUN yarn install --frozen-lockfile
RUN yarn build-ui
RUN yarn build-server

CMD node server/index.js

