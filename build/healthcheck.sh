#!/bin/sh
URL_TEXT=/config/url.txt
# URL_TEXT=/home/markrad/source/nodedaemon/build/test/config/url.txt        # for testing

[ -f $URL_TEXT ] && URL=$(head -n 1 $URL_TEXT) || exit 1

X=$(curl -q "$URL/healthcheck?entity=var.healthcheck" | jq '.status')

if [ "$X" = "200" ];
then
    exit 0
else
    exit 1
fi