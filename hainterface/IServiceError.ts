"use strict";
import { IServiceParent } from './IServiceParent';
import { IServiceErrorDetails } from './IServiceErrorDetails';

export interface IServiceError extends IServiceParent {
    id: number;
    type: "result";
    "success": false;
    error: IServiceErrorDetails;
}
