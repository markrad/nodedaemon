import YAML, { ScalarTag } from "yaml";
import Path from 'path';
import fs from 'fs';
// import { config } from "process";

export function getConfig(configFile: string): any {
    let secrets: any = {};
    let config: any = {};
    const secret: ScalarTag = {
        identify: value => value instanceof String,
        default: false,
        tag: '!secret',
        resolve(str) {
            if (!secrets[str]) {
                throw new Error(`Secret ${str} not found`);
            }
            else {
                return secrets[str];
            }
        },
    }
    
    secrets = YAML.parse(fs.readFileSync(Path.join(Path.dirname(configFile), 'secrets.yaml'), 'utf8'));
    config = YAML.parse(fs.readFileSync(configFile, 'utf8'),  { customTags: [secret] });
    return config;
}