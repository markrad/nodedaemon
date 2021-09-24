import { levels} from 'log4js';

export function LogLevelValidator(value: string): boolean {
    if (levels.getLevel(value) == levels.MARK) {
        return false;
    }

    return true;
}
