"use strict";
import { IServiceParent } from './IServiceParent';

export interface IServiceAuthOk extends IServiceParent {
    type: "auth_ok";
    ha_version: "string";
}
