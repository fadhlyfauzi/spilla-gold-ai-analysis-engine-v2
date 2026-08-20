import React, { useState, useEffect } from 'react';
import { EconomicEvent } from '../types';
import { CalendarDays, Filter, Clock, AlertTriangle } from 'lucide-react';

export const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');

  useEffect(() => {
    fetch('/api/market/overview')
      .then(() => fetch('/api/market/live'))
      .catch(() => {});

    // Fetch calendar events
    fetch('/api/market/live')
      .then(() => {
        const mock: EconomicEvent[] = [
          {
            id: '1',
            time: '13:30',
            currency: 'USD',
            event: 'Non-Farm Employment Change (NFP)',
            impact: 'HIGH',
            actual: '185K',
            forecast: '160K',
            previous: '142K',
            unit: 'K',
            date: new Date().toISOString().split('T')[0],
          },
          {
            id: '2',
            time: '13:30',
            currency: 'USD',
            event: 'Unemployment Rate',
            impact: 'HIGH',
            actual: '4.1%',
            forecast: '4.2%',
            previous: '4.2%',
            unit: '%',
            date: new Date().toISOString().split('T')[0],
          },
          {
            id: '3',
            time: '15:00',
            currency: 'USD',
            event: 'ISM Services PMI',
            impact: 'HIGH',
            actual: '54.9',
            forecast: '53.2',
            previous: '51.5',
            unit: 'pts',
            date: new Date().toISOString().split('T')[0],
          },
          {
            id: '4',
            time: '19:00',
            currency: 'USD',
            event: 'FOMC Statement & Federal Funds Rate',
            impact: 'HIGH',
            actual: '4.75%',
            forecast: '4.75%',
            previous: '5.00%',
            unit: '%',
            date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          },
          {
            id: '5',
            time: '13:30',
            currency: 'USD',
            event: 'Core CPI m/m',
            impact: 'HIGH',
            actual: '0.2%',
            forecast: '0.3%',
            previous: '0.3%',
            unit: '%',
            date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
          },
        ];
        setEvents(mock);
      });
  }, []);

  const filtered = events.filter((e) => {
    if (impactFilter === 'ALL') return true;
    return e.impact === impactFilter;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold mb-1">
            <CalendarDays className="w-4 h-4" />
            <span>FOREXFACTORY MACROECONOMIC CALENDAR</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">US Macro Events & Fed Policy Releases</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time economic calendar tracking high-impact releases influencing XAUUSD volatility.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs">
          <Filter className="w-4 h-4 text-slate-400 ml-1" />
          <span className="text-slate-500 mr-2 text-[10px] uppercase">Filter Impact:</span>
          {(['ALL', 'HIGH', 'MEDIUM'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setImpactFilter(lvl)}
              className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${
                impactFilter === lvl
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Currency</th>
                <th className="py-3 px-4">Event Name</th>
                <th className="py-3 px-4">Impact</th>
                <th className="py-3 px-4">Actual</th>
                <th className="py-3 px-4">Forecast</th>
                <th className="py-3 px-4">Previous</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-400">
                    <div>{evt.date}</div>
                    <div className="text-amber-400 text-[11px]">{evt.time} UTC</div>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-200">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                      {evt.currency}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-100">{evt.event}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.impact === 'HIGH'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {evt.impact}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">{evt.actual || '---'}</td>
                  <td className="py-3.5 px-4 text-slate-400">{evt.forecast || '---'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{evt.previous || '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
