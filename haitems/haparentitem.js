const EventEmitter = require('events');
const { emit } = require('process');

class HaParentItem extends EventEmitter {
    constructor(item, transport) {
        super();
        this._itemAttributes = item.attributes;
        this._name = '';
        this._type = '';
        [this._type, this._name] = item.entity_id.split('.');
        this._friendlyName = item.attributes.friendly_name;
        this._lastChanged = new Date(item.last_changed);
        this._lastUpdated = new Date(item.last_updated);
        this._state = item.state;
        this._transport = transport;
    }

    get itemAttributes() {
        return this._itemAttributes;
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
            itemAttributes: this.ItemAttributes,
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

    updateState(_newState) {
        let ret = new Promise((resolve, reject) => {
            reject(new Error('Descendent class is required to implement sendState'));
        });
    }

    callService(domain, service, state) {
        this.emit('callservice', domain, service, state);
    }
}

module.exports = HaParentItem;