"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandBase = void 0;
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
        this._parameters = this._validateInputParameters(value);
        ;
    }
    _validateParameters(parameters) {
        if (this.parameters == null) {
            if (parameters.length > 1) {
                throw new Error(`Command ${this.commandName} does not accept parameters`);
            }
        }
        else if (this.parameters.indexOf(parameters[1]) == -1) {
            throw new Error(`Command ${this.commandName} passed invalid parameter ${parameters[1]}`);
        }
    }
    tabTargets(_that, _tabCount, _parameters) {
        // If the command accepts a target then this needs to be overriden in the child
        return [];
    }
    tabParameters(that, tabCount, parameters) {
        if (parameters.length == 2) {
            if (this.parameters == null) {
                return [];
            }
            else {
                let possibles = this.parameters.filter((param) => param.startsWith(parameters[1]));
                if (possibles.length == 0 || (tabCount < 2 && possibles.length > 1)) {
                    return [];
                }
                else {
                    return possibles;
                }
            }
        }
        else {
            return this.tabTargets(that, tabCount, parameters);
        }
    }
    _validateInputParameters(parameters) {
        if (!parameters) {
            return null;
        }
        if (!Array.isArray(parameters) && typeof (parameters) != 'string') {
            throw new Error('Parameters must be an array of strings');
        }
        return Array.isArray(parameters) ? parameters : [parameters];
    }
}
exports.CommandBase = CommandBase;
//# sourceMappingURL=commandbase.js.map