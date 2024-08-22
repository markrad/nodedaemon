import { State } from "../hamain/state";
import { HaGenericUpdateableItem } from "./hagenericupdatableitem";

// FUTURE: Placeholder until we determine what we can do with this
export default class HaItemEvent extends HaGenericUpdateableItem {
    public constructor(item: State, logLevel?: string) {
        super(item, logLevel);
    }

    public get event_type(): string {
        return this.attributes.event_type;
    }

    public get event_types(): string[] {
        return this.attributes.event_types;
    }
}