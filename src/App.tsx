/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Play, Crown, ArrowRight, Home, Sparkles } from 'lucide-react';
import { LandingPage } from './components/LandingPage';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';

// Trigger comment for Github sync refresh
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'host' | 'player'>('landing');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginAnonymously = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      await signInAnonymously(auth);
    } catch (error: any) {
      if (error.code === 'auth/admin-restricted-operation') {
        setAuthError('HATA: Firebase Konsolu\'ndan "Anonymous Auth" (Anonim Giriş) özelliğini "Authentication > Sign-in method" altından etkinleştirmeniz gerekiyor.');
      } else {
        setAuthError('Giriş yapılırken bir hata oluştu: ' + error.message);
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-artistic-black flex items-center justify-center text-white font-sans">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-4xl md:text-6xl font-black italic text-artistic-yellow text-center px-6 uppercase tracking-tighter"
        >
          MELIS'S B-DAY QUIZ
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-artistic-black flex flex-col items-center justify-center p-6 text-center">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-artistic-yellow border-b-4 border-black -skew-y-3 origin-top-left -z-10" />
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white p-10 brutal-border brutal-shadow max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-artistic-red brutal-border flex items-center justify-center mx-auto mb-6 transform rotate-6">
            <Crown className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black text-black italic uppercase mb-2 tracking-tighter">MELIS'S QUIZ</h1>
          <p className="text-gray-500 font-bold mb-8 italic uppercase text-xs tracking-widest">En İyi Kim Biliyor?</p>
          
          <button
            onClick={loginAnonymously}
            className="w-full bg-artistic-blue text-white py-6 brutal-border brutal-shadow-white font-black text-2xl uppercase tracking-tighter transition-all hover:bg-black active:translate-y-1 active:shadow-none"
          >
            OYUNA BAŞLA
          </button>

          {authError && (
            <div className="mt-8 p-6 bg-red-50 border-4 border-artistic-red text-artistic-red text-sm font-black uppercase tracking-tight text-left leading-relaxed">
              ⚠️ {authError}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] font-sans selection:bg-artistic-blue selection:text-white">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <LandingPage key="landing" onHost={() => setView('host')} onJoin={() => setView('player')} />
        )}
        {view === 'host' && (
          <HostView key="host" onBack={() => setView('landing')} />
        )}
        {view === 'player' && (
          <PlayerView key="player" onBack={() => setView('landing')} />
        )}
      </AnimatePresence>
    </div>
  );
}
