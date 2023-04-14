"use strict";
import { IServiceParent } from './IServiceParent';

export interface IServiceAuthInvalid extends IServiceParent {
    type: "auth_invalid";
    message: "string";
}
