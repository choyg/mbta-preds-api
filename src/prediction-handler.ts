import { Prediction, PredictionEvent } from "./mbta-types";

export class PredictionHandler {
  constructor(
    private readonly stations: Map<string, Set<string>>,
    private readonly predictions: Map<string, Prediction>
  ) { }

  update(event: PredictionEvent) {
    this.add(event);
  }

  remove(event: PredictionEvent) {
    const prediction = this.predictions.get(event.id);
    if (!prediction) {
      return;
    }

    this.predictions.delete(event.id);

    const stationPreds = this.stations.get(prediction.station_id) || new Set<string>();
    stationPreds.delete(event.id);
    this.stations.set(prediction.station_id, stationPreds);
  }

  add(event: PredictionEvent) {
    const station_id = getStationId(event);
    const prediction: Prediction = {
      id: event.id,
      arrival_time: event.attributes.arrival_time,
      departure_time: event.attributes.departure_time,
      direction: event.attributes.direction_id,
      status: event.attributes.status,
      stop_id: event.relationships.stop.data.id,
      trip_id: event.relationships.trip.data.id,
      vehicle_id: event.relationships.vehicle.data.id,
      station_id: station_id
    };
    this.predictions.set(event.id, prediction);

    const stationPreds = this.stations.get(station_id) || new Set<string>();
    stationPreds.add(event.id);
    this.stations.set(station_id, stationPreds);
  }

  reset(events: PredictionEvent[]) {
    this.stations.clear();
    events.forEach(e => this.add(e));
  }

}

function getStationId(e: PredictionEvent) {
  const stopId = e.relationships.stop.data.id;
  const route = e.relationships.route.data.id;
  return `${stopId}-${route}`;
}