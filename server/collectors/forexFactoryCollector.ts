import { EconomicEvent } from '../../src/types.js';

class ForexFactoryCollector {
  public fetchEconomicCalendar(): EconomicEvent[] {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    return [
      {
        id: 'FF-101',
        time: '13:30',
        currency: 'USD',
        event: 'Non-Farm Employment Change (NFP)',
        impact: 'HIGH',
        actual: '185K',
        forecast: '160K',
        previous: '142K',
        unit: 'K',
        date: formatDate(today),
      },
      {
        id: 'FF-102',
        time: '13:30',
        currency: 'USD',
        event: 'Unemployment Rate',
        impact: 'HIGH',
        actual: '4.1%',
        forecast: '4.2%',
        previous: '4.2%',
        unit: '%',
        date: formatDate(today),
      },
      {
        id: 'FF-103',
        time: '13:30',
        currency: 'USD',
        event: 'Average Hourly Earnings m/m',
        impact: 'MEDIUM',
        actual: '0.3%',
        forecast: '0.3%',
        previous: '0.4%',
        unit: '%',
        date: formatDate(today),
      },
      {
        id: 'FF-104',
        time: '15:00',
        currency: 'USD',
        event: 'ISM Services PMI',
        impact: 'HIGH',
        actual: '54.9',
        forecast: '53.2',
        previous: '51.5',
        unit: 'pts',
        date: formatDate(today),
      },
      {
        id: 'FF-105',
        time: '19:00',
        currency: 'USD',
        event: 'FOMC Statement & Federal Funds Rate',
        impact: 'HIGH',
        actual: '4.75%',
        forecast: '4.75%',
        previous: '5.00%',
        unit: '%',
        date: formatDate(new Date(Date.now() + 86400000 * 2)),
      },
      {
        id: 'FF-106',
        time: '13:30',
        currency: 'USD',
        event: 'Core CPI m/m',
        impact: 'HIGH',
        actual: '0.2%',
        forecast: '0.3%',
        previous: '0.3%',
        unit: '%',
        date: formatDate(new Date(Date.now() + 86400000 * 5)),
      },
      {
        id: 'FF-107',
        time: '13:30',
        currency: 'USD',
        event: 'Core PPI m/m',
        impact: 'MEDIUM',
        actual: '0.2%',
        forecast: '0.2%',
        previous: '0.1%',
        unit: '%',
        date: formatDate(new Date(Date.now() + 86400000 * 6)),
      },
    ];
  }
}

export const forexFactoryCollector = new ForexFactoryCollector();
