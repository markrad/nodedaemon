"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationError = exports.WebSocketError = exports.DNSError = exports.ConnectionError = exports.GenericSyscallError = exports.HaInterfaceError = exports.ErrorFactory = void 0;
function ErrorFactory(err) {
    if (!(err instanceof Error)) {
        return err;
    }
    else if (err.syscall) {
        switch (err.syscall) {
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
exports.ErrorFactory = ErrorFactory;
class HaInterfaceError extends Error {
    constructor(err) {
        super(err.message);
        this.errno = err.errno;
        this.innerErr = err;
    }
}
exports.HaInterfaceError = HaInterfaceError;
class GenericSyscallError extends HaInterfaceError {
    constructor(err) {
        super(err);
        this.name = 'GenericSyscallError';
        this.syscall = err.syscall;
    }
}
exports.GenericSyscallError = GenericSyscallError;
class ConnectionError extends HaInterfaceError {
    constructor(err) {
        super(err);
        this.name = 'ConnectionError';
        this.code = err.code;
    }
}
exports.ConnectionError = ConnectionError;
class DNSError extends HaInterfaceError {
    constructor(err) {
        super(err);
        this.name = 'DNSError';
    }
}
exports.DNSError = DNSError;
class WebSocketError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.WebSocketError = WebSocketError;
class AuthenticationError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.AuthenticationError = AuthenticationError;
//# sourceMappingURL=haInterfaceError.js.map