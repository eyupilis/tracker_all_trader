import { Skeleton } from '@/components/ui/skeleton';

export default function TraderProfileLoading() {
    return (
        <main className="min-h-screen bg-slate-950 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Skeleton className="h-5 w-40 bg-slate-800" />

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-20 w-20 rounded-full bg-slate-800" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-6 w-56 bg-slate-800" />
                            <Skeleton className="h-4 w-3/4 bg-slate-800" />
                            <Skeleton className="h-4 w-1/2 bg-slate-800" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-16 bg-slate-800" />
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-2 flex flex-wrap gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-24 bg-slate-800" />
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-3">
                        <Skeleton className="h-5 w-36 bg-slate-800" />
                        <Skeleton className="h-60 w-full bg-slate-800" />
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-3">
                        <Skeleton className="h-5 w-36 bg-slate-800" />
                        <Skeleton className="h-60 w-full bg-slate-800" />
                    </div>
                </div>
            </div>
        </main>
    );
}
