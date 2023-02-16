import { ChildProcess, spawn } from 'node:child_process';

// FUTURE Use log4js?

enum ConsoleLevel {
    info = 0,
    warn = 1,
    error = 2,
};

class KeepAlive {
    private _target: string[];
    constructor(target: string[]) {
        this._target = target;
        this.logger(ConsoleLevel.info, 'KeepAlive constructed');
    }
    start(): KeepAlive {
        this.spawner();
        this.logger(ConsoleLevel.info, 'KeepAlive started');
        return this;
    }

    stop(): KeepAlive {
        this.logger(ConsoleLevel.info, 'KeepAlive stopped');
        process.kill(process.pid, 'SIGQUIT');
        return this;
    }

    private logger(level: ConsoleLevel, msg: string) {
        let now = new Date().toISOString();
        switch (level) {
            case ConsoleLevel.info:
                console.log(now + ' [INF] ' + msg);
                break;
            case ConsoleLevel.warn:
                console.warn(now + ' [WRN] ' + msg);
                break;
            case ConsoleLevel.error:
                console.error(now + ' [ERR] ' + msg);
                break;
            default:
                break;
        }
    }

    private spawner(code?: number, signal?: NodeJS.Signals) {
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
                this.logger(ConsoleLevel.info, 'Quit called');
                handlerCleanup();
                spawned.kill('SIGTERM');
            }
            var childExitHandler = (code: number, signal:NodeJS.Signals) => {
                handlerCleanup();
                this.spawner(code, signal);
            }
            var messageHandler = (m: Object) => {
                // FUTURE Implementation does nothing - possibly use for future enhancements
                this.logger(ConsoleLevel.info, `Message from child: '${JSON.stringify(m)}'`);
            }
            var spawnErrorHandler = (err: Error) => {
                this.logger(ConsoleLevel.error, `Spawn error - ${err}`);
                process.exit(4);
            }
        
            if (code != undefined) {
                this.logger(ConsoleLevel.warn, `Previous instance exited with ${code}`);
                if (code == 0) {
                    this.logger(ConsoleLevel.info, 'Treating zero return code as request to end');
                    return;
                }
                else if (code >= 32) {
                    this.logger(ConsoleLevel.warn, `Code ${code} is 32 or greater - treating as unrecoverable error`);
                    return;
                }
            }    
            else if (signal != undefined) {
                this.logger(ConsoleLevel.warn, `Previous instance terminated with ${signal}`);
            }

            if (code != undefined || signal != undefined) this.logger(ConsoleLevel.info, 'Restarting Child');

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
            this.logger(ConsoleLevel.error, `Caught error spawning: ${err}`);
            process.exit(4);
        }
    }
}

console.log(`parent pid: ${process.ppid}`);
new KeepAlive(process.argv.slice(2)).start();
