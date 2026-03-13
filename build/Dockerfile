# FROM node:18.12.1-slim
FROM node:18.12.1-alpine3.17
ENV DOCKER_RUNNING=true

# RUN apt update && apt -y upgrade
# RUN apt install -y git curl jq
RUN apk update
RUN apk --no-cache add curl jq git ca-certificates
RUN npm install -g npm@9.3.0
RUN npm install -g typescript
RUN git -c advice.detachedHead=false clone -b v1.8.15 https://github.com/markrad/nodedaemon.git

WORKDIR /nodedaemon

# RUN npm install -g npm@9.4.2
RUN npm install
RUN tsc

ADD healthcheck.sh ./healthcheck.sh
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "./healthcheck.sh" ]

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# TODO Add --inspect as arg between keepalive and nodedaemon
CMD [ "node", "./output/tools/keepalive/index.js", "./output/nodedaemon.js", "-c", "/config/config.yaml" ]
