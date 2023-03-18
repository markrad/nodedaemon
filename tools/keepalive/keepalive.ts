import { Logger } from 'log4js';
import { ChildProcess, spawn } from 'node:child_process';

export class KeepAlive {
    private _target: string[];
    private _logger: Logger;
    constructor(target: string[], logger: Logger) {
        this._target = target;
        this._logger = logger;
        this._logger.info('Constructed');
    }
    start(): KeepAlive {
        this.spawner();
        this._logger.info('Started');
        return this;
    }

    stop(): KeepAlive {
        this._logger.info('Stopped');
        process.kill(process.pid, 'SIGQUIT');
        return this;
    }

    private spawner(code?: number, signal?: NodeJS.Signals): void {
        try {
            let spawned: ChildProcess = null;

            var handlerCleanup = () => {
                spawned.off('exit', childExitHandler);
                spawned.off('message', messageHandler);
                spawned.off('error', spawnErrorHandler);
                process.off('SIGHUP', sighupHandler);
                process.off('SIGQUIT', sigquitHandler);
                process.off('message', messageHandler);
            }
            var sighupHandler = () => {
                spawned.kill('SIGTERM');
            }
            var sigquitHandler = () => {
                this._logger.info('Quit called');
                handlerCleanup();
                spawned.kill('SIGTERM');
            }
            var childExitHandler = (code: number, signal:NodeJS.Signals) => {
                handlerCleanup();
                this.spawner(code, signal);
            }
            var messageHandler = (m: Object) => {
                // FUTURE Implementation does nothing - possibly use for future enhancements
                this._logger.info(`Message from child: '${JSON.stringify(m)}'`);
            }
            var spawnErrorHandler = (err: Error) => {
                this._logger.error(`Spawn error - ${err}`);
                process.exit(4);
            }
        
            if (code != undefined) {
                this._logger.warn(`Previous instance exited with ${code}`);
                if (code == 0) {
                    this._logger.info('Treating zero return code as request to end');
                    return;
                }
                else if (code >= 32) {
                    this._logger.warn(`Code ${code} is 32 or greater - treating as unrecoverable error`);
                    return;
                }
            }    
            else if (signal != undefined) {
                this._logger.warn(`Previous instance terminated with ${signal}`);
            }

            if (code != undefined || signal != undefined) this._logger.info('Restarting Child');

            process.on('SIGHUP', sighupHandler);
            process.on('SIGQUIT', sigquitHandler);
            process.on('message', messageHandler);
            
            const env = Object.assign(process.env, { KEEPALIVE_RUNNING: process.pid });
            spawned = spawn('node', this._target, { cwd: process.cwd()/*, detached: true*/, stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ], env: env });
            spawned.on('error', spawnErrorHandler);
            spawned.on('message', messageHandler);
            spawned.on('exit', childExitHandler);
        }
        catch (err) {
            this._logger.error(`Caught error spawning: ${err}`);
            process.exit(4);
        }
    }
}
