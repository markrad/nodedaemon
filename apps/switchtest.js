var log4js = require('log4js');

const CATEGORY = 'SwitchTest';
var logger = log4js.getLogger(CATEGORY);

class SwitchTest {
    constructor(items, config) {
        this.testtoggle = items.testtoggle;
        this.bob = items.bob;
        this.interval = null;
        logger.debug('Constructed');
    }

    async run() {
        let tests = [
            async () => this.bob.updateState(0),
            async () => this.bob.updateState(10),
            async () => this.bob.updateState(20),
            async () => this.bob.updateState(30),
            async () => this.bob.updateState(40),
            async () => this.bob.updateState(50),
            async () => this.bob.updateState(50),
            async () => this.bob.updateState(50),
            async () => this.bob.updateState(150),
            async () => this.bob.incrementState(),
            async () => this.bob.decrementState(),
            async () => this.testtoggle.turnOn(),
            async () => this.testtoggle.turnOff(),
            async () => this.testtoggle.toggle(),
            async () => this.testtoggle.toggle(),
            async () => this.testtoggle.turnOn(),
            async () => this.testtoggle.turnOff(),
            async () => this.testtoggle.toggle(),
            async () => this.testtoggle.toggle(),
        ];
        let counter = 0;

        this.interval = setInterval(async () => {
            logger.info(`Current state testtoggle=${this.testtoggle.state} bob=${this.bob.state}`);
            await tests[counter++]();
            logger.info(`New state testtoggle=${this.testtoggle.state} bob=${this.bob.state}`);

            if (counter == tests.length) {
                clearInterval(this.interval);
            }
        }, 2 * 1000);
    }

    async stop() {
        clearInterval(this.interval);
    }
}

module.exports = SwitchTest;