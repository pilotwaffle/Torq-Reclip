import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DownloadTask, Format, Quality } from '../types';
import { Link2, Film, Music, Download, Settings2, Loader2, CheckCircle2, ChevronDown, ChevronRight, TerminalSquare, PlayCircle, FolderOpen, AlertTriangle, RotateCcw, X, Copy, Check } from 'lucide-react';
import { formatYtDlpError } from '../utils/errors';

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function Downloader() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<Format>('mp4');
  const [quality, setQuality] = useState<Quality>('best');
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [history, setHistory] = useState<DownloadTask[]>([]);
  const [activeTab, setActiveTab] = useState<'workbench' | 'history' | 'settings'>('workbench');
  const [hasCookies, setHasCookies] = useState(false);
  const [cookieText, setCookieText] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);

  // Guard against double execution in React StrictMode (dev) and multiple mounts
  const cookiesFetched = useRef(false);

  useEffect(() => {
    if (cookiesFetched.current) return;
    cookiesFetched.current = true;

    fetch('/api/cookies')
      .then(r => r.json())
      .then(d => setHasCookies(!!d.hasCookies))
      .catch(() => {});
  }, []);

  const saveCookies = async () => {
    setSavingCookies(true);
    try {
      await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookieText })
      });
      setHasCookies(cookieText.trim().length > 0);
      setCookieText('');
    } catch {}
    setSavingCookies(false);
  };

  useEffect(() => {
    const keysToRemove = [
      'demoErrorMode',
      'reclip_demo_error',
      'reclip:demoMode',
      'reclip:demoMode:v2',
      'url', 
      'tasks', 
      'reclip_url', 
      'reclip_tasks', 
      'reclip:tasks', 
      'reclip_demo_tasks',
      'reclip_history_tasks',
      'INITIAL_TASKS'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }, []);

  useEffect(() => {
    localStorage.setItem('reclip_history_tasks', JSON.stringify(history));
  }, [history]);

  const retryTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'queued', progress: 0, errorMessage: undefined } : t));
    executeTaskLifecycle(id, task.url, task.format, task.quality);
  };

  const dismissTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Process actual network requests for download
  const startDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const newTask: DownloadTask = {
      id: Math.random().toString(36).substring(2, 9),
      url: url.trim(),
      title: 'Resolving video metadata...',
      format,
      quality,
      progress: 0,
      status: 'queued',
      createdAt: Date.now(),
    };

    setTasks(prev => [newTask, ...prev]);
    setUrl('');
    executeTaskLifecycle(newTask.id, newTask.url, newTask.format, newTask.quality);
  };

  const executeTaskLifecycle = async (taskId: string, targetUrl: string, targetFormat: Format, targetQuality: Quality) => {
    const updateTask = (updates: Partial<DownloadTask> | ((t: DownloadTask) => Partial<DownloadTask>)) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...(typeof updates === 'function' ? updates(t) : updates) } : t));
    };

    updateTask({ status: 'fetching', title: 'Resolving video metadata...' });

    try {
      // 1. Fetch info
      const infoRes = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [targetUrl] })
      });
      
      const infoData = await infoRes.json();
      const info = infoData[0];
      
      if (!info || info.error) {
        updateTask({ status: 'error', errorMessage: info?.error || 'Failed to fetch video information.' });
        return;
      }

      const videoTitle = info.title || 'Unknown Video';
      updateTask({ 
        title: videoTitle,
        status: 'downloading',
        progress: 0 
      });

      // 2. Download
      const dlRes = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, format: targetFormat, format_id: targetQuality })
      });

      if (!dlRes.ok) {
        let errMessage = `Download failed with status ${dlRes.status}`;
        try {
          const errData = await dlRes.json();
          errMessage = errData.message || errData.error || errMessage;
        } catch (e) {
            // failed to parse json
        }
        updateTask({ status: 'error', errorMessage: errMessage });
        return;
      }

      updateTask({ status: 'processing', progress: 100 });

      // Get Blob and download it
      const blob = await dlRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      const contentDisposition = dlRes.headers.get('Content-Disposition');
      let filename = 'download';
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) filename = match[1];
      } else {
        filename = videoTitle ? `${videoTitle.replace(/[/\\?%*:|"<>]/g, '-')}.${targetFormat}` : `download.${targetFormat}`;
      }

      // Trigger download in browser
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 4. Completed
      setTasks((prev) => {
        const idx = prev.findIndex(t => t.id === taskId);
        if (idx === -1) return prev;
        
        const t = prev[idx];
        const completedTask: DownloadTask = {
          ...t,
          status: 'done' as const,
          title: filename,
          previewUrl: objectUrl,
          fileSizeBytes: blob.size
        };

        setHistory(h => {
          const withoutOld = h.filter(ht => ht.id !== taskId);
          return [completedTask, ...withoutOld];
        });

        const next = [...prev];
        next[idx] = completedTask;
        return next;
      });

    } catch (err: any) {
      updateTask({ status: 'error', errorMessage: err.message || 'Unknown network error' });
    }
  };

  const mp4Qualities: { label: string, value: Quality }[] = [
    { label: 'Best Quality (Auto)', value: 'best' },
    { label: '1080p', value: '1080p' },
    { label: '720p', value: '720p' },
  ];

  const mp3Qualities: { label: string, value: Quality }[] = [
    { label: 'High (320kbps)', value: 'audio-high' },
    { label: 'Medium (192kbps)', value: 'audio-medium' },
  ];

  const activeQualities = format === 'mp4' ? mp4Qualities : mp3Qualities;

  // Auto-adjust quality when format changes
  useEffect(() => {
    if (format === 'mp4' && !mp4Qualities.some(q => q.value === quality)) {
      setQuality('best');
    } else if (format === 'mp3' && !mp3Qualities.some(q => q.value === quality)) {
      setQuality('audio-high');
    }
  }, [format]);

  return (
    <div className="flex flex-col gap-8">
      {/* Navigation Tabs */}
      <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 shadow-sm w-full max-w-[340px] self-center">
        <button
          type="button"
          onClick={() => setActiveTab('workbench')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'workbench' 
              ? 'bg-zinc-800 text-amber-500 shadow-[0_2px_10px_rgba(0,0,0,0.2)] ring-1 ring-zinc-700/50' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          Workbench
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'history' 
              ? 'bg-zinc-800 text-amber-500 shadow-[0_2px_10px_rgba(0,0,0,0.2)] ring-1 ring-zinc-700/50' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" />
          History {history.length > 0 && <span className="text-[11px] bg-zinc-700/50 text-zinc-300 px-1.5 py-0.5 rounded-full">{history.length}</span>}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'settings' 
              ? 'bg-zinc-800 text-amber-500 shadow-[0_2px_10px_rgba(0,0,0,0.2)] ring-1 ring-zinc-700/50' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          Settings
        </button>
      </div>

      {activeTab === 'workbench' ? (
        <>
          {/* Workbench Input Card */}
          <div className="rounded-2xl border-2 border-zinc-800 bg-zinc-900/50 p-1 md:p-2 shadow-2xl">
        <form onSubmit={startDownload} className="flex flex-col bg-zinc-900 rounded-xl p-6 md:p-8 border border-zinc-800/80 gap-6 relative">

          <div className="flex flex-col gap-3">
            <label htmlFor="url" className="text-sm font-semibold text-zinc-300 flex items-center gap-2 uppercase tracking-wider">
              <Link2 className="w-4 h-4 text-amber-500" />
              Target Location
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <TerminalSquare className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                id="url"
                name="video_url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
                placeholder="Paste link from YouTube, TikTok, X, Instagram..."
                className="w-full bg-zinc-950 border border-zinc-700/50 text-zinc-100 rounded-lg pl-11 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 font-mono text-sm sm:text-base placeholder:text-zinc-600 transition-all shadow-inner"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Output Format</label>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setFormat('mp4')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                    format === 'mp4' 
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  Video (MP4)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('mp3')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                    format === 'mp3' 
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  Audio (MP3)
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Quality preset</label>
              <div className="relative">
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as Quality)}
                  className="w-full appearance-none bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg pl-4 pr-10 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 font-medium transition-all"
                >
                  {activeQualities.map(q => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 relative">
            <button
              type="submit"
              disabled={!url.trim()}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[15px] uppercase tracking-wide py-4 px-6 rounded-lg transition-colors active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none select-none relative"
            >
              <Download className="w-5 h-5" />
              Pull the Trigger
            </button>
          </div>
        </form>
      </div>

      {/* Task Queue Engine Output */}
      {tasks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Extraction Log
          </h3>
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {tasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onRetry={() => retryTask(task.id)}
                  onDismiss={() => dismissTask(task.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
        </>
      ) : activeTab === 'history' ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Download History
            </h3>
            {history.length > 0 && (
              <button 
                onClick={() => setHistory([])}
                className="text-xs font-semibold text-zinc-500 hover:text-rose-400 transition-colors uppercase tracking-wider"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {history.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center"
                >
                  <FolderOpen className="w-8 h-8 text-zinc-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-400">No activity yet</h4>
                    <p className="text-xs text-zinc-500 mt-1">Completed downloads will appear here.</p>
                  </div>
                </motion.div>
              ) : (
                history.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    onRetry={() => {}} // No retry in history
                    onDismiss={() => setHistory(prev => prev.filter(t => t.id !== task.id))}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
          
          {history.length > 0 && (
            <div className="flex items-center justify-between mt-2 border-t border-zinc-800/80 pt-4 px-2">
              <div className="text-xs text-zinc-500 font-bold tracking-wider uppercase">
                Session Total
              </div>
              <div className="text-sm font-mono text-zinc-300 font-medium">
                {formatBytes(history.reduce((acc, t) => acc + (t.fileSizeBytes || 0), 0))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Application Settings
            </h3>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-zinc-100 font-semibold flex items-center gap-2">
                  Authentication Cookies
                  {hasCookies ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Configured</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">Missing</span>
                  )}
                </h4>
                <p className="text-sm text-zinc-400 mt-1">
                  Provide cookies in Netscape format to bypass bot protection on platforms like YouTube or TikTok. You can export these using extensions like "Get cookies.txt".
                </p>
              </div>
            </div>
            
            <textarea
              value={cookieText}
              onChange={(e) => setCookieText(e.target.value)}
              placeholder="# Netscape HTTP Cookie File&#10;# https://curl.haxx.se/rfc/cookie_spec.html&#10;# This is a generated file!  Do not edit."
              className="w-full h-48 bg-black/50 border border-zinc-700/50 text-zinc-300 rounded-lg p-4 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-y"
            />
            
            <div className="flex justify-end pt-2">
              <button
                onClick={saveCookies}
                disabled={savingCookies || !cookieText.trim()}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm px-6 py-2.5 rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {savingCookies ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Cookies
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TaskItem: React.FC<{ task: DownloadTask; onRetry: () => void; onDismiss: () => void }> = ({ task, onRetry, onDismiss }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(task.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (task.status === 'error') {
    const errorInfo = formatYtDlpError(task.errorMessage || '');
    return (
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-rose-500/20 p-4 rounded-xl flex flex-col gap-3 overflow-hidden relative shadow-sm shadow-rose-900/10"
      >
        <div className="flex justify-between items-start gap-4 z-10 w-full">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <h4 className="font-medium text-rose-400 truncate flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorInfo.title}</span>
            </h4>
            <div className="text-sm text-zinc-300">
              {errorInfo.body}
            </div>
            <div className="text-xs font-mono text-zinc-500 truncate mt-1">
              {task.url.length > 60 ? task.url.substring(0, 60) + '...' : task.url}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              <button 
                onClick={onRetry} 
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-md text-xs font-semibold transition-colors border border-rose-500/20"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 
                Retry
              </button>
              <button 
                onClick={onDismiss} 
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 rounded-md text-xs font-medium transition-colors border border-zinc-700"
              >
                <X className="w-3.5 h-3.5" /> 
                Dismiss
              </button>
              {task.errorMessage && (
                <button 
                  onClick={() => setShowErrorDetails(!showErrorDetails)} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-transparent text-zinc-500 hover:text-zinc-300 rounded-md text-xs font-medium transition-colors ml-auto mr-0 sm:ml-0"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showErrorDetails ? 'rotate-90' : ''}`} /> 
                  Show details
                </button>
              )}
            </div>
            
            <AnimatePresence>
              {showErrorDetails && task.errorMessage && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <pre className="bg-black/50 border border-zinc-800/80 rounded-lg p-3 text-[11px] leading-relaxed text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">
                    {task.errorMessage}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-3 overflow-hidden relative"
    >
      <div className="flex justify-between items-start gap-4 z-10 w-full">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <h4 className="font-medium text-zinc-100 truncate flex items-center gap-2">
            {task.format === 'mp4' ? <Film className="w-4 h-4 text-zinc-500 shrink-0" /> : <Music className="w-4 h-4 text-zinc-500 shrink-0" />}
            <span className="truncate">{task.title}</span>
          </h4>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
            <span className="truncate max-w-[200px] sm:max-w-xs">{task.url}</span>
            <span>•</span>
            <span className="uppercase">{task.quality}</span>
            {task.fileSizeBytes !== undefined && (
              <>
                <span>•</span>
                <span>{formatBytes(task.fileSizeBytes)}</span>
              </>
            )}
          </div>
          
          {/* Action Buttons for Completed */}
          <AnimatePresence>
            {task.status === 'done' && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                className="flex flex-wrap gap-3"
              >
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className="group flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 rounded border border-amber-500/20 hover:border-amber-500 font-semibold text-xs tracking-wide transition-all shadow-sm"
                >
                  {showPreview ? <ChevronDown className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" /> : <PlayCircle className="w-4 h-4 transition-transform group-hover:scale-110" />}
                  {showPreview ? 'Hide Preview' : `Play ${task.format === 'mp4' ? 'Video' : 'Audio'}`}
                </button>
                <button 
                  onClick={copyUrl}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 rounded border border-zinc-700 hover:border-zinc-500 font-medium text-xs tracking-wide transition-all shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy URL'}
                </button>
                <button 
                  onClick={onDismiss}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-transparent text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 rounded text-xs font-medium transition-colors ml-auto mr-0 sm:ml-0 hover:border-rose-500/20 border border-transparent"
                >
                  <X className="w-4 h-4" />
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="shrink-0 pt-0.5">
          <StatusBadge status={task.status} progress={task.progress} />
        </div>
      </div>

      {/* Progress Bar */}
      {(task.status === 'downloading' || task.status === 'processing') && (
        <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden z-10 border border-zinc-800">
          <motion.div 
            className="h-full bg-amber-500 relative"
            initial={{ width: 0 }}
            animate={{ width: `${task.progress}%` }}
            transition={{ ease: "linear", duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-white/20" style={{ 
              backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)', 
              backgroundSize: '1rem 1rem' 
            }} />
          </motion.div>
        </div>
      )}
      
      {/* Video/Audio Preview Drawer */}
      <AnimatePresence>
        {showPreview && task.previewUrl && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden z-10 w-full"
          >
            <div className="pt-4">
              {task.format === 'mp4' ? (
                <video 
                  src={task.previewUrl} 
                  controls 
                  autoPlay
                  className="w-full rounded-lg bg-black border border-zinc-800 aspect-video object-contain"
                />
              ) : (
                <audio 
                  src={task.previewUrl} 
                  controls 
                  autoPlay
                  className="w-full h-12 outline-none rounded-lg"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background completed flash */}
      {task.status === 'done' && (
        <motion.div 
          initial={{ opacity: 0.1 }} 
          animate={{ opacity: 0 }} 
          className="absolute inset-0 bg-amber-500 pointer-events-none"
        />
      )}
    </motion.div>
  );
}

function StatusBadge({ status, progress }: { status: DownloadTask['status'], progress: number }) {
  switch (status) {
    case 'queued':
    case 'fetching':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
          <Loader2 className="w-3 h-3 animate-spin" />
          {status === 'queued' ? 'Queued' : 'Fetching Info'}
        </span>
      );
    case 'downloading':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 font-mono">
          <Download className="w-3 h-3 animate-bounce" />
          {progress}%
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
          <Settings2 className="w-3 h-3 animate-spin" />
          Processing Format
        </span>
      );
    case 'done':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          Done
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
          Failed
        </span>
      );
    default:
      return null;
  }
}
