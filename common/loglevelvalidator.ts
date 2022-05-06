import { Level, levels} from 'log4js';

export function LogLevels(): string[] {
    const ignoreLevels: string[] = [ 'ALL', 'OFF', 'MARK' ];
    return levels.levels
        .filter(item => !ignoreLevels.includes(item.levelStr))
        .map(item => item.levelStr);
}

export function LogLevelValidator(value: string | Level): boolean {
    if (levels.getLevel(value) == undefined) {
        return false;
    }

    return true;
}
