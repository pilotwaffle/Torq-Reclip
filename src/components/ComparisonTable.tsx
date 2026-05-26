import React from 'react';
import { motion } from 'motion/react';
import { Shield, ShieldAlert, Zap, Lock, FolderOpen } from 'lucide-react';

export function ComparisonTable() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-500" />
          Why a Builder Likes It
        </h2>
        <p className="text-zinc-400 max-w-2xl">
          It’s like the difference between borrowing some random guy’s janky saw from Craigslist versus having your own high-quality Milwaukee or DeWalt tool that you control.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="p-4 font-medium text-zinc-400 w-1/2">Regular Download Sites</th>
              <th className="p-4 font-medium text-amber-500 w-1/2">ReClip (Your Own Tool)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            <TableRow 
              bad="Full of ads and pop-ups" 
              good="Clean, no ads, no nonsense" 
            />
            <TableRow 
              bad="Tracks everything you do" 
              good="Runs on your computer only" 
            />
            <TableRow 
              bad="Can be slow or unreliable" 
              good="Fast and consistent" 
            />
            <TableRow 
              bad="You don’t own the tool" 
              good="You own the tool completely" 
            />
            <TableRow 
              bad="Risk of malware" 
              good="Open source — you can see exactly what it does" 
            />
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <FeatureCard 
          icon={<Zap className="w-5 h-5 text-amber-500" />}
          title="The Engine"
          description="Powered by yt-dlp. It’s like the high-torque motor inside your tool. It pulls video from over 1,000 different websites flawlessly."
        />
        <FeatureCard 
          icon={<FolderOpen className="w-5 h-5 text-amber-500" />}
          title="Typical Uses"
          description="Save tutorials for offline shop viewing, turn hour-long podcasts into MP3s, or bulk archive content before it gets deleted."
        />
      </div>
    </div>
  );
}

function TableRow({ bad, good }: { bad: string; good: string }) {
  return (
    <tr className="transition-colors hover:bg-zinc-800/20">
      <td className="p-4 text-zinc-300">
        <div className="flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500/70 mt-0.5 shrink-0" />
          {bad}
        </div>
      </td>
      <td className="p-4 text-zinc-100 font-medium">
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-500/70 mt-0.5 shrink-0" />
          {good}
        </div>
      </td>
    </tr>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col gap-3">
      <div className="flex items-center gap-2 font-semibold text-zinc-100">
        {icon}
        {title}
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
