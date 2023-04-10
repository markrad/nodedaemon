#!/bin/bash

X=$(curl http://localhost:4526/healthcheck | jq '.status')

if [ "*$X" == "*200" ];
then
    exit 0
else
    exit 1
fi