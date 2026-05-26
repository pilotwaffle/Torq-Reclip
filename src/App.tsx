import { Wrench } from 'lucide-react';
import { Downloader } from './components/Downloader';
import { ComparisonTable } from './components/ComparisonTable';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 font-sans selection:bg-amber-500/30 pb-20">
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
      
      <div className="max-w-3xl mx-auto px-5 py-12 flex flex-col gap-12 relative">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 p-2 rounded-lg text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Wrench className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
              Re<span className="text-amber-500">Clip</span>
            </h1>
          </div>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Your own dedicated workbench tool for video extraction. Clean, private, and on your terms.
          </p>
        </header>

        <main className="flex flex-col gap-16">
          <Downloader />
          <div className="h-px w-full bg-zinc-800/50" />
          <ComparisonTable />
        </main>
      </div>
    </div>
  );
}
