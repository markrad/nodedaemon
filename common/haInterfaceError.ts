"use strict";

export function ErrorFactory(err: Error) {
    if (!(err instanceof Error)) {
        return err;
    }
    else if ((err as any).syscall) {
        switch ((err as any).syscall) {
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
    errno: number;
    innerErr: Error;
    name: string;
    syscall?: number;
    code?: string;
    constructor(err: Error) {
        super(err.message);
        this.errno = (err as any).errno;
        this.innerErr = err;
    }
}

export class GenericSyscallError extends HaInterfaceError {
    constructor(err: Error) {
        super(err);
        this.name = 'GenericSyscallError';
        this.syscall = (err as any).syscall;
    }
}

export class ConnectionError extends HaInterfaceError {
    constructor(err: Error) {
        super(err);
        this.name = 'ConnectionError';
        this.code = (err as any).code;
    }
}

export class DNSError extends HaInterfaceError {
    constructor(err: Error) {
        super(err);
        this.name = 'DNSError';
    }
}

export class WebSocketError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
    }
}
