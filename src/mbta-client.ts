import axios, { AxiosInstance } from 'axios';
export class MbtaClient {

  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api-v3.mbta.com',
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/vnd.api+json'
      }
    });
  }

  async getRoutes(etag?: string) {
    const { data } = await this.client.get('/routes', {
      params: {
        'filter[type]': '0,1',
        include: ['stop']
      }
    })

    return data;
  }

  async getRoutePatterns(etag?: string) {
    const { data } = await this.client.get('/route_patterns');
  }

  async getStops(stops: string[]) {
    const { data } = await this.client.get('/stops')
  }

  async getPredictions() {
    const { data } = await this.client.get('/predictions/', {
      params: {
        'filter[route_type]': '0,1'
      }
    })

    return data;
  }

}