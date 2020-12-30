const EventEmitter = require('events');
const { Logger } = require('log4js');
const { resolve } = require('path');
const { emit } = require('process');

// Super slow for debugging
const RESPONSE_TIMEOUT_DEBUG = 30 * 1000
const RESPONSE_TIMEOUT = 3 * 1000


class HaParentItem extends EventEmitter {
    constructor(item) {
        super();
        this._attributes = item.attributes;
        this._name = '';
        this._type = '';
        [this._type, this._name] = item.entity_id.split('.');
        this._friendlyName = item.attributes.friendly_name;
        this._lastChanged = new Date(item.last_changed);
        this._lastUpdated = new Date(item.last_updated);
        this._state = item.state;
    }

    get attributes() {
        return this._attributes;
    }

    get name() {
        return this._name;
    }

    get friendlyName() {
        return this._friendlyName;
    }

    get type() {
        return this._type;
    }

    get lastChanged() {
        return this._lastChanged;
    }

    get lastUpdated() {
        return this._lastUpdated;
    }

    get state() {
        return this._state;
    }

    get entityId() {
        return `${this.type}.${this.name}`;
    }

    get category() {
        return `${this.__proto__.constructor.name}:${this.entityId}`;
    }

    setReceivedState(newState) {
        let oldState = {
            attributes: this.attributes,
            state: this.state,
            lastUpdated: this.lastUpdated,
            lastChanged: this.lastChanged,
        };

        this._attributes = newState.attributes;
        this._state = newState.state;
        this._lastUpdated = new Date(newState.last_updated);
        this._lastChanged = new Date(newState.last_changed);
        this.emit('new_state', this, oldState);
    }

    async updateState(_newState) {
        let ret = new Promise((_resolve, reject) => {
            reject(new Error('Descendent class is required to implement sendState'));
        });
    }

    callService(domain, service, state) {
        this.emit('callservice', domain, service, state);
    }

    _callServicePromise(resolve, newState, expectedState, domain, service, state) {
        
        if (service == 'error') {
            err = new Error(`Bad value passed to updateState - ${newState}`);
            this.logger.error(`${err.message}`);
            resolve(action, err);
            return;
        }

        if (this.state != expectedState || this._childOveride(state)) {
            var timer = setTimeout(() => {
                var err = new Error('Timeout waiting for state change');
                this.logger.warn(`${err.message}`);
                resolve('error', err);
            }, RESPONSE_TIMEOUT);

            this.once('new_state', (that, _oldState) => {
                clearTimeout(timer);
                
                if (that.state == expectedState) {
                    resolve('success');
                }
                else {
                    var err = new Error('New state did not match expected state');
                    this.logger.info(`${err.message}`);
                    resolve('warn', err);
                }
            });

            this.callService(domain, service, state);
        }
        else {
            this.logger.debug(`Already in state ${this.state}`);
            resolve('success');
        }
    }

    _childOveride() {
        return false;
    }

    _getActionAndExpectedSNewtate(newState) {
        return { action: newState, expectedNewState: newState };
    }
}

module.exports = HaParentItem;