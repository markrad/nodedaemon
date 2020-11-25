const https = require('https');
var log4js = require('log4js');

const CATEGORY = 'DynDnsUpdater';
var logger = log4js.getLogger(CATEGORY);

class DynDnsUpdater {
    constructor(items, config) {
        this.external_ip = items.external_ip;
        //this.config = config;
        this.first = true;
        this.user = config.dyndnsupdater.user;
        this.updaterKey = config.dyndnsupdater.updaterKey;
        this.hostname = config.dyndnsupdater.hostname;
        logger.debug('Constructed');
    }

    async run() {
        this.external_ip.on('new_state', (item, oldState) => {
            if (this.first == true || item.state != oldState.state) {
                logger.info(`Updating DynDNS IP address to ${item.state}`);
                this.first = false;
                let allchunks = '';
                let options = {
                    headers: {
                        'User-Agent': 'Radrealm - HassTest - v0.0.1'
                    }
                };

                https.get(`https://${this.user}:${this.updaterKey}@members.dyndns.org/v3/update?hostname=${this.hostname}&myip=${item.state}`, options, (res) => {
                    res.setEncoding('utf8');
                    res.on('data', chunk => allchunks += chunk);
                    res.on('end', () => {
                        logger.debug(`DynDns response: ${allchunks}`);
                        switch (allchunks.split(' ')[0]) {
                        case 'good':
                        case 'nochg':
                            logger.info(`DynDns IP address successfully updated to ${item.state}`);
                            break;
                        case 'badauth':
                            logger.error('DynDns authorization is invalid');
                            break;
                        case 'notfqdn':
                            logger.error('This hostname not fully qualified');
                            break;
                        case 'nohost':
                            logger.error('The host name is missing or invalid');
                            break;
                        case 'numhost':
                            logger.error('Attempted to update too many hosts in one call');
                            break;
                        case 'abuse':
                            logger.error('The specified host name has been blocked for abuse');
                            break;
                        case 'dnserr':
                        case '911':
                            logger.error('Bad user name or password');
                            break;
                        default:
                            logger.error(`Update failed with unrecognized code: ${allchunks}`);
                        }
                    });
                }).on('error', (err) => {
                    logger.error(`Failed to update IP address: ${err}`);
                    rejects(err);
    
                });
            }
        });
    }

    async stop() {

    }
}

module.exports = DynDnsUpdater;