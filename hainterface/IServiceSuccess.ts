"use strict";
import { IServiceParent } from './IServiceParent';

export interface IServiceSuccess extends IServiceParent {
    id: number;
    type: "result";
    success: true;
    result: any;
}
