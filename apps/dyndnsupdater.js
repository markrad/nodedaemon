const https = require('https');
var log4js = require('log4js');

const CATEGORY = 'DynDnsUpdater';
const ONE_DAY = 86400;
var logger = log4js.getLogger(CATEGORY);

class DynDnsUpdater {
    constructor(items, config) {
        this.external_ip = items.external_ip;
        this.lastUpdate = items.last_dns_update;
        this.user = config.dyndnsupdater.user;
        this.updaterKey = config.dyndnsupdater.updaterKey;
        this.hostname = config.dyndnsupdater.hostname;
        logger.debug('Constructed');
    }

    async run() {
        this.external_ip.on('new_state', (item, oldState) => {
            var now = new Date();
            var then = new Date(this.lastUpdate.state);

            if (isNaN(then.getDate())) {
                this.updateTime = new Date(0);
            }
    
            // Update when IP address changes or at least once every 24 hours
            if (now.valueOf() / 1000 - then.valueOf() / 1000 > ONE_DAY || item.state != oldState.state) {
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
                            let nowString = now.getFullYear() + '-' +
                                        (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                                        now.getDate().toString().padStart(2, '0') + ' ' +
                                        now.getHours().toString().padStart(2, '0') + ':' +
                                        now.getMinutes().toString().padStart(2, '0') + ':' +
                                        now.getSeconds().toString().padStart(2, '0');
                            this.lastUpdate.updateState(nowString);
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