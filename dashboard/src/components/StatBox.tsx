'use client';

const statNumberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

interface StatBoxProps {
  label: string;
  value: number;
  icon: string;
}

export function StatBox({ label, value, icon }: StatBoxProps) {
  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] px-5 py-4 flex items-center gap-3">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <div>
        <div className="text-[#848e9c] text-xs">{label}</div>
        <div className="text-white font-bold text-xl">{statNumberFormatter.format(value)}</div>
      </div>
    </div>
  );
}
