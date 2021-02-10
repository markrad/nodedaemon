const http = require('http');
var log4js = require('log4js');
const { resolve } = require('path');

const CATEGORY = 'UpdateExternalIP';
var logger = log4js.getLogger(CATEGORY);

class UpdateExternalIP {
    constructor(controller, config) {
        this.external_ip = controller.items.external_ip;
        this.config = config;
        this.delay = 5;
        this.multiplier = 24;       // Check every two minutes
        this.interval = 0;
        logger.debug('Constructed');
    }

    async run() {
        let counter = 0;

        this.interval = setInterval(async (multiplier) => {
            if (++counter % multiplier == 0) {
                counter = 0;
                try {
                    let currentIP = await this.whatsMyIP();

                    logger.info(`Updating external IP address to ${currentIP}`);
                    this.external_ip.updateState(currentIP);
                }
                catch (err) {
                    logger.error(`Could not get IP address: ${err}`);
                }
            }
        }, this.delay * 1000, this.multiplier);
    }

    async stop() {
        clearInterval(this.interval);
    }

    async whatsMyIP() {
        const IP_HOST = 'api.ipify.org';
        return new Promise((resolve, reject) => {
            const options = {
                host: IP_HOST,
                port: 80,
                path: '/',
            };
    
            let allchunks = '';
    
            http.get(options, res => {
                if (res.statusCode != 200) {
                    let err = new Error(`Error status code returned from IP server ${res.statusCode}`);
                    logger.error(err.Message);
                    reject(err)
                }
                res.setEncoding('utf8');
                res.on('data', chunk => allchunks += chunk);
                res.on('end', () => resolve(allchunks));
            }).on('error', (err) => {
                logger.error(`Failed to connect to ${IP_HOST}: ${err}`);
                reject(err);
            });
        });
    }
}

module.exports = UpdateExternalIP;