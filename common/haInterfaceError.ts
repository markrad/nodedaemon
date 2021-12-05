"use strict";

export function ErrorFactory(err: Error) {
    if (!(err instanceof Error)) {
        return err;
    }
    else if ((err as HaInterfaceError).syscall) {
        switch ((err as HaInterfaceError).syscall) {
            case 'getaddrinfo':
                return new DNSError(err);
            case 'connect':
                return new ConnectionError(err);
            default:
                return err;
        }
    }

    else {
        return err;
    }
}

export class HaInterfaceError extends Error {
    public errno: number;
    public innerErr: Error;
    public name: string;
    public syscall?: string;
    public code?: string;
    public constructor(err: Error) {
        super(err.message);
        this.errno = (err as HaInterfaceError).errno;
        this.innerErr = err;
    }
}

export class GenericSyscallError extends HaInterfaceError {
    public constructor(err: Error) {
        super(err);
        this.name = 'GenericSyscallError';
        this.syscall = (err as HaInterfaceError).syscall;
    }
}

export class ConnectionError extends HaInterfaceError {
    public constructor(err: Error) {
        super(err);
        this.name = 'ConnectionError';
        this.code = (err as HaInterfaceError).code;
    }
}

export class DNSError extends HaInterfaceError {
    public constructor(err: Error) {
        super(err);
        this.name = 'DNSError';
    }
}

// export class WebSocketError extends Error {
//     public constructor(message: string) {
//         super(message);
//     }
// }
