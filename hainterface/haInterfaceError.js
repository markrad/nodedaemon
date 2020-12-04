function ErrorFactory(err) {
    if (err.__proto__.constructor.name != 'Error') {
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

class HaInterfaceError extends Error {
    constructor(err) {
        super(err.message);
        this.errno = err.errno;
        this.innerErr = err;
    }
}

class GenericSyscallError extends HaInterfaceError {
    constructor(err) {
        super(err);
        this.name - 'GenericSyscallError';
        this.syscall = err.syscall;
    }
}

class ConnectionError extends HaInterfaceError {
    constructor(err) {
        super(err);
        this.name - 'ConnectionError';
    }
}

class DNSError extends HaInterfaceError {
    constructor(err) {
        super(err);
        this.name = 'DNSError';
    }
}

class WebSocketError extends Error {
    constructor(message) {
        super(message);
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
    }
}

module.exports = { ErrorFactory, GenericSyscallError, ConnectionError, DNSError, WebSocketError, AuthenticationError };