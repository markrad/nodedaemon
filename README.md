# nodedaemon
This was inspired by Home Assistant's appdaemon but, rather than using Python, this uses JavaScript running under Node JS. It's not that I dont' like Python (or C# for that matter) I just happen to have written way more JavaScript so it seemed to be an obvious choice.

## Installation
At this time, I have not pushed this to npm since it is still very much a work in progress. Currently you will need to clone the repo, create a config file, and execute it by passing nodedaemno.js as the parameter to node.

## Overview
The idea behind this is that each entity that is defined in HA will be represented by a JavaScript object. These are all stored in a JavasScript object keyed by the entity's name. This is passed to the applications and will emit a state change so that the application can take action. Each object is specialized for the type of entity and exposes useful functions such as turnOn, isOn, etc. **However many of these item types have not yet been fleshed out**. Essentially I get to them as I need them.

## Running
There is a sample config file called config_sample.json. By default the script will look for this file in the same directory as itself. You can however, modify this location with the _-c_ or _--config_ flag on the command line specifying an absolute or relative path and file name. 

Entering _node nodedeamon.js --help_ will display command line parameter help.

Provided are a number of applications that demonstrate how one can subscribe to entity events and modify their state such as turning on lights etc. Also notice that the config file is passed to the applications so you can add any additional configuration to that file that is specific to your applications. The sample config file has some of these. 

## Bottom Line
It's pretty useable now. Has a cool ssh interface that lets you look at your entities directly. I'll admit that I can do most of what I need in HA yaml or from the UI but I still like having this option for something more or just debugging.
