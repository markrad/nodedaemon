"use strict";
import { IServiceParent } from './IServiceParent';

export interface IServiceEvent extends IServiceParent {
    id: number;
    type: "event";
    event: any;
}
