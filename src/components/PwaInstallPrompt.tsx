import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Don't show if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return;
        }

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-[#161625]/90 backdrop-blur-xl border border-indigo-500/30 p-4 rounded-2xl flex items-center justify-between shadow-2xl shadow-indigo-500/20 animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center gap-3">
                <img src="icon-192.png" alt="App Icon" className="w-10 h-10 rounded-xl" />
                <div>
                    <h4 className="text-white text-sm font-bold">Install KAK App</h4>
                    <p className="text-white/60 text-[10px]">Fast access from your home screen</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowPrompt(false)}
                    className="text-white/40 hover:text-white px-2 py-1 text-xs font-bold"
                >
                    Later
                </button>
                <button
                    onClick={handleInstallClick}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                    <Download size={14} /> Install
                </button>
            </div>
        </div>
    );
}
