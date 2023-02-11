echo Starting nodedaemon
ls -al
node --inspect=0.0.0.0:9229 ./output/nodedaemon.js -c /config/config.yaml

# Wait forever
tail -f /dev/null