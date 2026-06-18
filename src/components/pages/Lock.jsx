'use client';

import { useState } from 'react';
import { Delete } from 'lucide-react';
import { useStore } from '@/state/store';
import { toast } from '@/components/ui/Toast.jsx';

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function LockScreen() {
  const login = useStore((s) => s.login);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  async function press(key) {
    if (loading) return;
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= 8) return;

    const next = pin + key;
    setPin(next);

    if (next.length >= 4) {
      setLoading(true);
      try {
        await login(next);
      } catch {
        setShake(true);
        setError('Incorrect PIN');
        setPin('');
        setTimeout(() => setShake(false), 500);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center safe-top safe-bottom">
      <div className="w-full max-w-xs px-6 flex flex-col items-center gap-8">
        <div className="text-center">
          <p className="text-4xl font-extrabold text-white mb-1">🔐</p>
          <h1 className="text-2xl font-extrabold text-white">Expenses App</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        {/* Dots */}
        <div className={`flex gap-4 ${shake ? 'animate-bounce' : ''}`}>
          {[0,1,2,3].map((i) => (
            <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? 'bg-brand-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        {error && <p className="text-expense text-sm font-semibold -mt-4">{error}</p>}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {PAD.map((key, i) => key === '' ? <div key={i} /> : (
            <button
              key={i}
              onClick={() => press(key)}
              className={`h-16 rounded-2xl text-2xl font-bold transition active:scale-90 active:bg-gray-700
                ${key === '⌫' ? 'text-gray-400 bg-transparent' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              {key === '⌫' ? <Delete size={22} className="mx-auto" /> : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
