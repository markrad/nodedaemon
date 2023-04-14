"use strict";
import { IServiceParent } from './IServiceParent';

export interface IServiceAuthRequired extends IServiceParent {
    type: "auth_required";
    ha_version: "string";
}
