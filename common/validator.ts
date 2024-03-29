import { existsSync, readFileSync } from "fs";
import { HaMain } from "../hamain";
import { IHaItem } from "../haitems/ihaitem";
import { URL } from "node:url";

type validatorOptions = {
    name?: string;
    noValueOk?: boolean;
}

type stringValidatorOptions = validatorOptions & {
    defaultValue?: string;
}

export class stringValidator {
    static isValid(value: any, options?: stringValidatorOptions): string {
        let opt = { ...{  name: '', noValueOk: false, defaultValue: null }, ...options };
        if (!value) {
            if (!opt.noValueOk) throw new Error(`${opt.name} missing value`);
            if (opt.defaultValue) return opt.defaultValue;
            else return value;
        }
        if (typeof value != 'string') throw new Error(`${value} not a string`);
        return value;
    }
}

type fileValidatorOptions = validatorOptions & {
    returnContent?: boolean;
    encoding?: string;
}

export class fileValidator {
    static isValid(value: any, options?: fileValidatorOptions): string  {
        let opt = { ...{ name: '', encoding: 'utf8', returnContent: false }, ...options };
        let work = stringValidator.isValid(value, opt);
        if (work) {
            if (!existsSync(work)) throw new Error(`${opt.name ?? ''} file ${value} does not exist`);
            if (opt.returnContent == true) return readFileSync(work, { encoding: 'utf8' });
        }
        else {
            return work;
        }
    }
}

type entityValidatorOptions<T extends IHaItem> = stringValidatorOptions & {
    entityType: { new (...args: any[]): T }
}

export class entityValidator {
    static isValid<T extends IHaItem>(value: any, options: entityValidatorOptions<T>): T {
        let opt = { ...{ name: ''}, ...options };
        let work = stringValidator.isValid(value, opt);
        if (work) return HaMain.getInstance().items.getItemAsEx(value, options.entityType, true);
        throw new Error(`${opt.name} entity not found`);
    }
}

type numberValidatorOptions = validatorOptions & {
    defaultValue?: number;
    minValue?: number;
    maxValue?: number;
    floatOk?: boolean;
}

export class numberValidator {
    static isValid(value: any, options: numberValidatorOptions): number {
        let opt: numberValidatorOptions = { ...{ name: '', defaultValue: null, minValue: null, maxValue: null, floatOk: false }, ...options };
        if (!value) {
            if (!opt.defaultValue) throw new Error(`${opt.name} missing value`);
            if (opt.defaultValue) return opt.defaultValue;
            else return value
        }
        let work = parseFloat(value);
        if (isNaN(work)) throw new Error(`${opt.name} is not a number`);
        if (!opt.floatOk && work != Math.floor(work)) throw new Error(`${opt.name} is not an integer`);
        if (opt.minValue && work < opt.minValue) throw new Error(`${opt.name} is less than the allowed minimum`);
        if (opt.maxValue && work > opt.maxValue) throw new Error(`${opt.name} is greater than the allowed maximum`);
        return work;
    }
}

export class urlValidator {
    static isValid(urlstring: string): URL {
        try {
            return new URL(urlstring);
        }
        catch (err) {
            throw new Error(`${urlstring} is invalid - ${err.message}`);
        }
    }
}