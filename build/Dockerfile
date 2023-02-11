FROM node:18.12.1-slim

RUN apt update && apt -y upgrade
RUN apt install -y git
RUN npm install -g npm@9.3.0
RUN npm install -g typescript
RUN git -c advice.detachedHead=false clone -b v1.4.0 https://github.com/markrad/nodedaemon.git

WORKDIR /nodedaemon

RUN npm install -g npm@9.4.2
RUN npm install
RUN tsc

COPY ./startup.sh ./

# CMD [ "tail", "-f", "/etc/passwd"]
# CMD [ "node", "--inspect=0.0.0.0:9229", "./output/nodedaemon.js", "-c", "/config/config.yaml" ]
CMD [ "/bin/bash", "./startup.sh" ]