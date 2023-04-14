"use strict";
import { IServiceParent } from './IServiceParent';

export interface IServiceAuth extends IServiceParent {
    type: "auth";
    access_token: string;
}
