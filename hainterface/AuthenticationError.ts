"use strict";
export class AuthenticationError extends Error {
    public constructor(message: string) {
        super(message);
    }
}
