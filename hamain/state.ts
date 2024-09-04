/**
 * Represents the state of an entity as received from Home Assistant.
 */
export type State = {
    entity_id: string;
    last_changed: string;
    last_updated: string;
    state: string; // | number | boolean;
    attributes: any;
    context: any;
}

/**
 * Represents the old and new state of an entity.
 */
export type StateChange = {
    entity_id: string;
    old_state: State;
    new_state: State;
}
