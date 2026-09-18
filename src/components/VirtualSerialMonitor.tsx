import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Send, Play, RefreshCw } from 'lucide-react';
import { SerialLogMessage } from '../types';

interface VirtualSerialMonitorProps {
  logs: SerialLogMessage[];
  onClearLogs: () => void;
  onSendCommand: (cmd: string) => void;
}

export const VirtualSerialMonitor: React.FC<VirtualSerialMonitorProps> = ({
  logs,
  onClearLogs,
  onSendCommand,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onSendCommand(inputVal.trim());
    setInputVal('');
  };

  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg h-full max-h-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-mono font-semibold">Arduino Serial Monitor</span>
          <span className="bg-slate-800 text-emerald-400 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-700">
            115200 baud
          </span>
          <span className="bg-slate-800 text-slate-400 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-700">
            COM (Uno)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
            />
            Autoscroll
          </label>
          <button
            type="button"
            onClick={onClearLogs}
            title="Clear Console"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Output */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 select-text bg-[#030712]">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">No output yet. Power on or trip beam to view serial stream...</div>
        ) : (
          logs.map((item) => {
            let color = 'text-slate-300';
            if (item.type === 'alarm') color = 'text-rose-400 font-bold';
            else if (item.type === 'radar') color = 'text-cyan-400';
            else if (item.type === 'system') color = 'text-amber-300';
            else if (item.type === 'info') color = 'text-emerald-400';

            return (
              <div key={item.id} className="leading-relaxed break-all">
                <span className="text-slate-600 select-none mr-2">[{item.timestamp}]</span>
                <span className={color}>{item.message}</span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>

      {/* Command Input / Quick Actions */}
      <div className="p-2 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type 'R' to reset and rearm..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono rounded flex items-center gap-1 transition"
          >
            <Send className="w-3 h-3" />
            Send
          </button>
          <button
            type="button"
            onClick={() => onSendCommand('R')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-mono rounded flex items-center gap-1 transition"
            title="Quick Send 'R'"
          >
            <RefreshCw className="w-3 h-3" />
            Send 'R'
          </button>
        </form>
      </div>
    </div>
  );
};
