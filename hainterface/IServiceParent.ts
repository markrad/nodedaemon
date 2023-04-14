"use strict";
import { PacketTypesIn } from "./PacketTypesIn";

export interface IServiceParent {
    type: string;
    name: PacketTypesIn;
}
