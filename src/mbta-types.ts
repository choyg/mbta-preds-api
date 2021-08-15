export interface Attributes {
  arrival_time: string;
  departure_time: string;
  direction_id: number;
  schedule_relationship?: any;
  status: string | null;
  stop_sequence: number;
}

export interface Relationships {
  route: Route;
  stop: Stop;
  trip: Trip;
  vehicle: Vehicle;
}

export interface Relation {
  data: {
    id: string;
    type: string;
  }
}

export interface Route extends Relation { }
export interface Stop extends Relation { }
export interface Trip extends Relation { }
export interface Vehicle extends Relation { }

export interface PredictionEvent extends Event {
  attributes: Attributes;
  id: string;
  relationships: Relationships;
  type: StreamingEventType;
}

export enum StreamingEventType {
  RESET = 'reset',
  ADD = 'add',
  UPDATE = 'update',
  REMOVE = 'remove'
}

export interface Prediction {
  id: string;
  arrival_time: string | null;
  departure_time: string | null;
  status: string | null;
  stop_id: string;
  trip_id: string;
  vehicle_id: string;
  station_id: string;
  direction: number;
}