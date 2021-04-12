var log4js = require('log4js');

const CATEGORY = 'CommandBase';
var logger = log4js.getLogger(CATEGORY);

class CommandBase {
    constructor(commandName, parameters) {
        this._commandName = commandName;
        this._parameters = this._validateInputParameters(parameters);
    }

    get commandName() {
        return this._commandName;
    }

    get parameters() {
        return this._parameters;
    }

    set parameters(value) {
        this._parameters = this._validateInputParameters(value);;
    }

    validateParameters(parameters) {
        if (this.parameters == null) {
            if (parameters.length > 1) {
                throw new Error(`Command ${this.commandName} does not accept parameters`);
            }
        }
        else if (this.parameters.indexOf(parameters[1]) == -1) {
            throw new Error(`Command ${this.commandName} passed invalid parameter ${parameters[1]}`);
        }
    }

    _validateInputParameters(parameters) {
        if (!parameters) {
            return null;
        }

        if (!Array.isArray(parameters) && typeof(parameters) != 'string') {
            throw new Error('Parameters must be an array of strings');
        }

        return Array.isArray(parameters) ? parameters : [ parameters ];
    }
}

module.exports = CommandBase