import { join } from 'path';
import fsp from 'fs/promises';
import fs from 'fs';
import parseSync from 'csv-parse/lib/sync';
import parseStream from 'csv-parse';
import { routes } from './index';


export class Gtfs {

  async getRouteStops() {
    const routePatternsCsv = await fsp.readFile(join(__dirname, '../../gtfs/route_patterns.txt'), { encoding: 'utf-8' });
    const routeSet = new Set(routes);
    const routeTrips = new Map<string, string[]>();
    let routePatterns: RoutePattern[] = parseSync(routePatternsCsv, { columns: true, skipEmptyLines: true, })
    routePatterns.forEach((rp) => {
      if (!routeSet.has(rp.route_id)) {
        return;
      }

      if (rp.route_pattern_typicality !== '1') {
        return;
      }

      const trips = routeTrips.get(rp.route_id) || [];
      trips.push(rp.representative_trip_id);
      routeTrips.set(rp.route_id, trips);
    });

    const tripStops = await this.getStopIds([...routeTrips.values()].flat());

    const stopIds = [...tripStops.values()].flatMap(stoptimes => stoptimes.map(st => st.stop_id));
    const stops = await this.loadStops(stopIds);
    const stations = await this.getStations();

    const routeTripStops: any = {};

    [...routeTrips.keys()].forEach((routeId) => {
      const routeTripStopIds = new Set<string>();
      const routeStations = new Set<string>();
      const trips = routeTrips.get(routeId)!;
      trips.forEach((trip) => {
        tripStops.get(trip)!.forEach(st => {
          return routeTripStopIds.add(stops[st.stop_id].parent_station);
        });
      });
      routeTripStops[routeId] = [...routeTripStopIds.values()];
    });

    console.log(stations);

    return {
      stations,
      stops,
      routeTripStops
    };
  }

  private getStations(): Promise<{ [stopId: string]: Stop }> {
    const stops: { [stopId: string]: Stop } = {};
    return new Promise((resolve, reject) => {
      const stopsCsv = fs.createReadStream(join(__dirname, '../../gtfs/stops.txt'), { encoding: 'utf-8' });
      const parser = stopsCsv.pipe(parseStream({
        columns: true, skipEmptyLines: true
      }));

      parser.on('error', (err) => {
        console.error(err);
      });

      parser.on('data', (stop: StopCsv) => {
        if (stop.vehicle_type) {
          return;
        }

        if (stop.parent_station) {
          return;
        }

        stops[stop.stop_id] = {
          stop_code: stop.stop_code,
          stop_desc: stop.stop_desc,
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          platform_name: stop.platform_name,
          parent_station: stop.parent_station,
        };
      });

      parser.on('end', () => {
        resolve(stops);
      });
    });
  }

  private getStopIds(trips: string[]): Promise<Map<string, StopTime[]>> {
    const tripSet = new Set(trips);
    const tripStations = new Map<string, StopTime[]>();

    return new Promise((resolve, reject) => {
      const stopTimesCsv = fs.createReadStream(join(__dirname, '../../gtfs/stop_times.txt'), { encoding: 'utf-8' });
      const parser = stopTimesCsv.pipe(parseStream({
        columns: true, skipEmptyLines: true, cast: (val, ctx) => {
          if (ctx.column === 'stop_sequence') {
            return Number.parseInt(val);
          }
          return val;
        }
      }));
      parser.on('error', (err) => {
        console.error(err);
      });

      parser.on('data', (stopTime: StopTime) => {
        if (!tripSet.has(stopTime.trip_id)) {
          return;
        }

        const stopList = tripStations.get(stopTime.trip_id) || [];
        stopList.push(stopTime);
        tripStations.set(stopTime.trip_id, stopList);
      });

      parser.on('end', () => {
        resolve(tripStations);
      });
    });
  }

  private loadStops(stopIds: string[]): Promise<{ [stopId: string]: Stop }> {
    const stopIdSet = new Set(stopIds);
    const stops: { [stopId: string]: Stop } = {};
    return new Promise((resolve, reject) => {
      const stopsCsv = fs.createReadStream(join(__dirname, '../../gtfs/stops.txt'), { encoding: 'utf-8' });
      const parser = stopsCsv.pipe(parseStream({
        columns: true, skipEmptyLines: true
      }));

      parser.on('error', (err) => {
        console.error(err);
      });

      parser.on('data', (stop: Stop) => {
        if (!stopIdSet.has(stop.stop_id)) {
          return;
        }

        stops[stop.stop_id] = {
          stop_code: stop.stop_code,
          stop_desc: stop.stop_desc,
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          platform_name: stop.platform_name,
          parent_station: stop.parent_station
        };
      });

      parser.on('end', () => {
        resolve(stops);
      });
    });
  }
}

export interface RoutePattern {
  route_pattern_id: string;
  route_id: string;
  direction_id: number;
  route_pattern_name: string;
  representative_trip_id: string;
  route_pattern_typicality: string;
}

export interface StopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
}

export interface Stop {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  stop_desc: string;
  platform_name: string;
  parent_station: string;
}

export interface StopCsv extends Stop {
  vehicle_type: string;
}