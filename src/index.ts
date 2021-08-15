import EventSource from 'eventsource';
import express from 'express';
import fs from 'fs/promises';
import { join } from "path";
import config from '../config';
import { Gtfs } from "./load-gtfs";
import { Prediction, StreamingEventType } from "./mbta-types";
import { PredictionHandler } from "./prediction-handler";

const events = Object.values(StreamingEventType);
export const routes = ['Red', 'Mattapan', 'Orange', 'Green-B', 'Green-C', 'Green-D', 'Green-E', 'Blue'];

// stop_id => prediction id
const platforms = new Map<string, Set<string>>();
// prediction id => prediction
const predictions = new Map<string, Prediction>();

function esConnect() {
  const handlers = new PredictionHandler(platforms, predictions);
  const es = new EventSource("https://api-v3.mbta.com/predictions?filter%5Broute%5D=Blue", {
    headers: {
      "X-API-Key": config.API_KEY
    }
  });
  events.forEach((event) => {
    es.addEventListener(event, (ev: any) => {
      const predictionEvent = JSON.parse(ev.data);
      ((handlers)[event])(predictionEvent);
    });
  });
  let lastConn = 500;
  es.addEventListener('error', (err: any) => {
    console.error(err);
    if (es.readyState === es.CLOSED) {
      es.close();
      setTimeout(() => {
        esConnect();
      }, lastConn *= 2);
    }
  });

}

async function lol() {
  try {

    let routeStops: any;
    try {
      routeStops = JSON.parse(await fs.readFile(join(__dirname, '../.cache/route-stops.json'), { encoding: 'utf-8' }));
    } catch (err) {
      routeStops = await new Gtfs().getRouteStops();
      await fs.writeFile(join(__dirname, '../.cache/route-stops.json'), JSON.stringify(routeStops));
    }

    const parentChildren: any = Object.values(routeStops.stops).reduce<Record<string, string[]>>((acc: any, stop: any) => {
      const children: string[] = acc[stop.parent_station] || [];
      children.push(stop.stop_id);
      acc[stop.parent_station] = children;
      return acc;
    }, {} as any);

    esConnect();

    const app = express();
    app.use((req, res, next) => {
      console.info({
        method: req.method,
        url: req.url,
      })
      next();
    });
    app.use(express.json());

    app.post('/predictions', (req, res) => {
      const requests: PredictionRequest[] = req.body;
      const predictions = requests.map(predReq => {
        return fjdsioak({ parentChildren, ...predReq })
      });
      res.json(predictions);
    });

    app.get('/platforms', (req, res) => {
      res.json([...platforms.keys()]);
    });

    app.get('/metadata', (req, res) => {
      res.json(routeStops);
    });

    app.listen('3500', () => console.info(`Listening on port 3500`));


  } catch (err) {
    console.error(err?.response?.data || err)
  }
}
lol();

interface PredictionRequest {
  station: string;
  route: string;
}

function fjdsioak({ parentChildren, station, route }: any) {
  const platformIds = parentChildren[station]?.map((stopId: string) => `${stopId}-${route}`)
  if (!platformIds) {
    return [];
  }
  const predIds = platformIds.flatMap((pid: string) => [...platforms.get(pid)?.values() || []]);
  const preds: Prediction[] = [];
  if (!predIds) {
    return [];
  }
  predIds.forEach((id: string) => {
    const prediction = predictions.get(id);
    if (prediction) {
      const time = prediction.arrival_time || prediction.departure_time;
      if (time && new Date(time).valueOf() > Date.now()) {
        preds.push(prediction);
      }
    }
  });
  preds.sort((a, b) => new Date(a.departure_time || a.arrival_time!!).valueOf() - new Date(b.departure_time || b.arrival_time!!).valueOf())

  return preds;
}