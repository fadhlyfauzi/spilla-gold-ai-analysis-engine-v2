import React, { useEffect, useState } from 'react';
import { CollectorStatus, SystemLog } from '../types';
import { Database, Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Server } from 'lucide-react';

export const CollectorStatusView: React.FC = () => {
  const [collectors, setCollectors] = useState<CollectorStatus[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchStatus = async () => {
    try {
      const colRes = await fetch('/api/collectors');
      const colData = await colRes.json();
      setCollectors(colData.collectors || []);

      const logRes = await fetch('/api/logs');
      const logData = await logRes.json();
      setLogs(logData.logs || []);
    } catch (err) {
      console.error('Error fetching collectors status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold text-[10px]">
            <CheckCircle2 className="w-3 h-3" /> ONLINE
          </span>
        );
      case 'SYNCING':
        return (
          <span className="flex items-center gap-1 text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 font-bold text-[10px]">
            <RefreshCw className="w-3 h-3 animate-spin" /> SYNCING
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold text-[10px]">
            <AlertTriangle className="w-3 h-3" /> WARNING
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-bold text-[10px]">
            <XCircle className="w-3 h-3" /> OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Database className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-extrabold text-white tracking-wider uppercase">
              Data Collectors & Engine Health
            </h2>
          </div>
          <p className="text-gray-400 text-xs font-sans">
            Real-time pipeline status for 12 data collectors feeding the SPILLA GOLD quantitative engine.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#c49f27] text-black font-bold cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Pipelines</span>
        </button>
      </div>

      {/* Collector Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collectors.map((c) => (
          <div
            key={c.id}
            className="bg-[#121620] border border-gray-800 rounded-xl p-4 flex flex-col justify-between hover:border-gray-700 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-white text-sm tracking-wide">{c.name}</span>
                {getStatusBadge(c.status)}
              </div>
              <div className="text-[11px] text-gray-400 mb-3">
                Source: <span className="text-gray-200">{c.source}</span>
              </div>
            </div>

            <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800/80 space-y-1 text-[11px]">
              <div className="flex justify-between text-gray-400">
                <span>Latency:</span>
                <span className="text-emerald-400 font-bold">{c.latencyMs} ms</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Item Count:</span>
                <span className="text-white font-bold">{c.itemCount} records</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Last Run:</span>
                <span className="text-gray-300">{new Date(c.lastRun).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Real-time System Log Console */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center space-x-2 font-bold text-white">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>REAL-TIME SYSTEM LOG STREAM</span>
          </div>
          <span className="text-gray-500 text-[10px]">AUTO-SCROLL ENABLED</span>
        </div>

        <div className="bg-[#0B0E14] p-4 rounded-lg border border-gray-800 max-h-60 overflow-y-auto space-y-1.5 font-mono text-[11px] text-gray-300">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-3 hover:bg-gray-900/50 p-1 rounded">
              <span className="text-gray-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span
                className={`font-bold shrink-0 ${
                  log.level === 'ERROR'
                    ? 'text-rose-400'
                    : log.level === 'WARN'
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}
              >
                [{log.level}]
              </span>
              <span className="text-[#D4AF37] shrink-0">[{log.module}]</span>
              <span className="text-gray-200 truncate">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
