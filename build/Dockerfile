FROM arm32v7/node:17.5-slim

RUN apt update && apt -y upgrade
RUN apt install -y git
RUN npm install -g typescript
RUN git clone -b v1.1.14 https://github.com/markrad/nodedaemon.git

WORKDIR /nodedaemon

# RUN npm install -g npm@8.5.1
RUN npm install
RUN tsc

# CMD [ "tail", "-f", "/etc/passwd"]
CMD [ "node", "--inspect=0.0.0.0:9229", "./output/nodedaemon.js", "-c", "/config/config.yaml", "-l", "debug" ]