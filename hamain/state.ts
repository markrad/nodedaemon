export type State = {
    entity_id: string;
    last_changed: string;
    last_updated: string;
    state: string; // | number | boolean;
    attributes: any;
    context: any;
}

export type StateChange = {
    entity_id: string;
    old_state: State;
    new_state: State;
}
