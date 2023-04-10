FROM node:18.12.1-slim
ENV DOCKER_RUNNING=true

RUN apt update && apt -y upgrade
RUN apt install -y git
RUN npm install -g npm@9.3.0
RUN npm install -g typescript
RUN git -c advice.detachedHead=false clone -b v1.6.28 https://github.com/markrad/nodedaemon.git

WORKDIR /nodedaemon

# RUN npm install -g npm@9.4.2
RUN npm install
RUN tsc

# CMD [ "node", "--inspect=0.0.0.0:9229", "./output/nodedaemon.js", "-c", "/config/config.yaml" ]
# TODO Add --inspect as arg between keepalive and nodedaemon
CMD [ "node", "./output/tools/keepalive/index.js", "./output/nodedaemon.js", "-c", "/config/config.yaml" ]
