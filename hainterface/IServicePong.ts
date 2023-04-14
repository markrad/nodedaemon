"use strict";
import { IServiceParent } from './IServiceParent';

export interface IServicePong extends IServiceParent {
    id: number;
    type: "pong";
}
