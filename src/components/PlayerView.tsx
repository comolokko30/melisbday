import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';
import confetti from 'canvas-confetti';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, query, where, getDocs, updateDoc, onSnapshot, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { GameSession, Participant, Question } from '../types';
import { CheckCircle2, XCircle, Trophy, Users, Star, ArrowRight, Loader2, Crown, Cake, Gift } from 'lucide-react';
import { Counter } from './Counter';

interface Props {
  onBack: () => void;
  key?: string;
}

const COLORS = [
  'bg-[#e21b3c]', // Red
  'bg-[#1368ce]', // Blue
  'bg-[#d89e00]', // Yellow
  'bg-[#26890c]', // Green
];

export function PlayerView({ onBack }: Props) {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answering, setAnswering] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pinParam = urlParams.get('pin');
    if (pinParam && pinParam.length === 6) {
      setPin(pinParam);
    }
  }, []);

  useEffect(() => {
    if (session) {
      const unsubSession = onSnapshot(doc(db, `game_sessions/${session.id}`), (doc) => {
        if (doc.exists()) {
          setSession({ id: doc.id, ...doc.data() } as GameSession);
        }
      });

      const unsubParticipant = onSnapshot(doc(db, `game_sessions/${session.id}/participants/${auth.currentUser?.uid}`), (doc) => {
        if (doc.exists()) {
          setParticipant({ id: doc.id, ...doc.data() } as Participant);
        }
      });

      const unsubAllParticipants = onSnapshot(collection(db, `game_sessions/${session.id}/participants`), (snapshot) => {
        setAllParticipants(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
      });

      const unsubQuestions = onSnapshot(collection(db, `game_sessions/${session.id}/questions`), (snapshot) => {
        setQuestions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question)).sort((a, b) => a.order - b.order));
      });

      return () => {
        unsubSession();
        unsubParticipant();
        unsubAllParticipants();
        unsubQuestions();
      };
    }
  }, [session?.id]);

  useEffect(() => {
    setAnswering(false);
  }, [session?.currentQuestionIndex]);

  useEffect(() => {
    if (session && session.status === 'results') {
      const lastAns = participant?.lastAnswer;
      const isCorrect = lastAns?.questionIndex === session.currentQuestionIndex && lastAns.isCorrect;
      
      if (isCorrect) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FF0000', '#0000FF', '#FFFFFF']
        });
      }
    }

    if (session && session.status === 'finished') {
       const sorted = [...allParticipants].sort((a, b) => b.score - a.score);
       const rank = sorted.findIndex(p => p.id === auth.currentUser?.uid) + 1;
       
       // Confetti for podium players
       if (rank <= 3) {
          const duration = 15 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
          const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

          const interval: any = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
          }, 250);
          return () => clearInterval(interval);
       }
    }
  }, [session?.status, participant?.lastAnswer?.isCorrect]);

  const joinGame = async (e: FormEvent) => {
    e.preventDefault();
    if (!pin || !name || !auth.currentUser) return;
    setJoining(true);
    setError('');

    try {
      const q = query(collection(db, 'game_sessions'), where('pin', '==', pin), where('status', '==', 'waiting'));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('Oyun bulunamadı veya çoktan başladı.');
        setJoining(false);
        return;
      }

      const sessionDoc = snapshot.docs[0];
      const sessionId = sessionDoc.id;

      await setDoc(doc(db, `game_sessions/${sessionId}/participants`, auth.currentUser.uid), {
        name,
        score: 0,
        createdAt: serverTimestamp()
      });

      setSession({ id: sessionId, ...sessionDoc.data() } as GameSession);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'participants');
    } finally {
      setJoining(false);
    }
  };

  const submitAnswer = async (choiceIndex: number) => {
    if (!session || !participant || answering) return;
    const currentQ = questions[session.currentQuestionIndex];
    if (!currentQ) return;

    if (participant.lastAnswer?.questionIndex === session.currentQuestionIndex) return;

    setAnswering(true);
    try {
      const isCorrect = choiceIndex === currentQ.correctIndex;
      const points = isCorrect ? 1000 : 0;

      await updateDoc(doc(db, `game_sessions/${session.id}/participants`, auth.currentUser!.uid), {
        score: increment(points),
        lastAnswer: {
          questionIndex: session.currentQuestionIndex,
          choiceIndex,
          isCorrect,
          pointsEarned: points,
          timestamp: serverTimestamp()
        }
      });
    } catch (err) {
       handleFirestoreError(err, OperationType.UPDATE, 'participant');
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-artistic-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-artistic-yellow border-b-4 border-black -skew-y-3 origin-top-left -z-10" />
        
        <motion.form
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           onSubmit={joinGame}
           className="bg-white p-6 md:p-10 brutal-border brutal-shadow w-full max-w-sm relative z-10"
        >
          <div className="absolute -top-4 -right-4 md:-top-6 md:-right-6 w-12 h-12 md:w-16 md:h-16 bg-artistic-red brutal-border flex items-center justify-center rotate-12 text-white">
            <Star className="w-6 h-6 md:w-8 md:h-8 fill-current" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black text-black mb-6 md:mb-8 text-center italic tracking-tighter uppercase leading-none">MELIS'IN<br/>DOĞUM GÜNÜ</h2>
          
          <div className="space-y-4 md:space-y-6">
            <div className="space-y-1">
              <label className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">OYUN KODU</label>
              <input
                type="text"
                placeholder="000 000"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full bg-white text-black p-3 md:p-5 brutal-border font-black text-center text-2xl md:text-3xl focus:bg-artistic-yellow transition-colors"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">TAKMA ADIN</label>
              <input
                type="text"
                placeholder="İSMİNİZİ YAZIN"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={15}
                className="w-full bg-white text-black p-3 md:p-5 brutal-border font-black text-center text-lg md:text-xl focus:bg-artistic-blue transition-colors uppercase"
                required
              />
            </div>
          </div>

          {error && <p className="mt-4 text-artistic-red font-black text-center text-xs uppercase tracking-widest">{error}</p>}

          <button
            type="submit"
            disabled={joining || pin.length < 6 || !name}
            className="w-full mt-8 bg-black text-white py-5 brutal-border brutal-shadow font-black text-2xl uppercase tracking-tighter hover:bg-artistic-red transition-all active:translate-y-1 active:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {joining ? <Loader2 className="animate-spin" /> : 'GİRİŞ YAP'}
          </button>
          
          <button type="button" onClick={onBack} className="w-full mt-6 text-gray-400 font-black hover:text-black uppercase text-[10px] tracking-[0.3em] transition-colors">İPTAL</button>
        </motion.form>
      </div>
    );
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen bg-artistic-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div
           animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
           transition={{ repeat: Infinity, duration: 4 }}
           className="w-32 h-32 bg-artistic-yellow brutal-border brutal-shadow flex items-center justify-center mb-10 transform -rotate-12"
        >
          <Crown className="text-black w-16 h-16" />
        </motion.div>
        <h2 className="text-5xl font-black text-white italic mb-2 tracking-tighter uppercase leading-none text-center">HOŞ GELDİN!</h2>
        <p className="text-artistic-red font-black text-3xl uppercase mb-12 tracking-tighter">{name}</p>
        <div className="bg-white p-8 brutal-border brutal-shadow-white max-w-xs">
          <p className="text-black font-black uppercase text-sm tracking-widest animate-pulse leading-relaxed">
            Melis'in quiz'i başlamak üzere... <br/>
            Başarılar dileriz!
          </p>
        </div>
      </div>
    );
  }

  if (session.status === 'playing') {
    const hasAnswered = participant?.lastAnswer?.questionIndex === session.currentQuestionIndex;

    if (hasAnswered || answering) {
      return (
        <div className="min-h-screen bg-artistic-black flex flex-col items-center justify-center p-6 text-center">
           <div className="w-16 h-16 border-4 border-artistic-yellow/20 border-t-artistic-yellow animate-spin mb-6" />
           <h2 className="text-4xl font-black text-white italic mb-2 uppercase tracking-tighter text-center">GÖNDERİLDİ!</h2>
           <p className="text-artistic-yellow font-black uppercase tracking-widest text-xs text-center px-4">Melis bir sonraki adımı bekliyor...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-artistic-black flex flex-col p-4 gap-3 overflow-hidden">
        <div className="bg-artistic-yellow p-4 brutal-border mb-2 text-black font-black uppercase italic flex justify-between items-center">
          <span>SORU {session.currentQuestionIndex + 1}</span>
          <div className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-xs">
            {session.currentQuestionIndex + 1}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 md:gap-6 flex-1 max-w-lg mx-auto w-full">
          {COLORS.map((color, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.94 }}
              onClick={() => submitAnswer(i)}
              className={`${color} brutal-border brutal-shadow-white relative group flex items-center justify-center overflow-hidden min-h-[140px] md:min-h-0`}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="bg-white/20 p-4 md:p-6 brutal-border rotate-45 transform">
                <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-white" />
              </div>
              <div className="absolute bottom-2 right-3 text-white/20 text-3xl md:text-5xl font-black italic tracking-tighter select-none">
                {String.fromCharCode(65 + i)}
              </div>
            </motion.button>
          ))}
        </div>
        
        <div className="h-4 bg-black brutal-border overflow-hidden mt-2">
           <motion.div 
             initial={{ width: '0%' }}
             animate={{ width: '100%' }}
             transition={{ duration: 15, ease: 'linear' }}
             className="h-full bg-artistic-red"
           />
        </div>
      </div>
    );
  }

  if (session.status === 'results') {
    const currentQ = questions[session.currentQuestionIndex];
    const lastAns = participant?.lastAnswer;
    const isCorrect = lastAns?.questionIndex === session.currentQuestionIndex && lastAns.isCorrect;

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden ${isCorrect ? 'bg-[#26890c]' : 'bg-artistic-red'}`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none text-[15vw] md:text-[20vw] font-black italic transform -rotate-12 flex flex-wrap gap-10 md:gap-20 leading-none">
          {isCorrect ? 'DOĞRU DOĞRU' : 'YANLIŞ YANLIŞ'}
        </div>

        <motion.div
           initial={{ scale: 0 }}
           animate={{ scale: 1 }}
           className="relative z-10 mb-6"
        >
          {isCorrect ? (
             <div className="bg-white p-4 brutal-border brutal-shadow shadow-black">
               <CheckCircle2 className="w-20 h-20 md:w-32 md:h-32 text-[#26890c]" />
             </div>
          ) : (
             <div className="bg-black p-4 brutal-border brutal-shadow-white shadow-white">
               <XCircle className="w-20 h-20 md:w-32 md:h-32 text-white" />
             </div>
          )}
        </motion.div>
        
        <h2 className="text-4xl md:text-7xl font-black italic tracking-tighter mb-4 relative z-10 uppercase drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] px-4">
           {isCorrect ? 'MÜKEMMEL!' : 'ÜZGÜNÜZ!'}
        </h2>
        
        <div className="relative z-10 mt-4 bg-black/40 p-6 brutal-border backdrop-blur-sm max-w-xs w-full">
           <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60 text-white">Doğru Cevap Şuydu:</p>
           <p className="text-xl md:text-2xl font-black uppercase tracking-tight">{currentQ?.options[currentQ.correctIndex]}</p>
        </div>

        <div className="mt-8 relative z-10">
          <p className="text-white font-black uppercase text-[10px] tracking-widest mb-1 opacity-60">ŞU ANKİ PUANIN</p>
          <div className="text-4xl font-black tracking-tighter italic">
            {participant?.score || 0}
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'leaderboard') {
    const lastAns = participant?.lastAnswer;
    const isCorrect = lastAns?.questionIndex === session.currentQuestionIndex && lastAns.isCorrect;
    
    const sorted = [...allParticipants].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex(p => p.id === auth.currentUser?.uid) + 1;

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 md:p-8 text-center text-white relative overflow-hidden ${isCorrect ? 'bg-[#26890c]' : 'bg-artistic-red'}`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none text-[15vw] md:text-[20vw] font-black italic transform -rotate-12 flex flex-wrap gap-10 md:gap-20 leading-none">
          {isCorrect ? 'YES YES YES' : 'NO NO NO'}
        </div>

        <motion.div
           initial={{ scale: 0, rotate: -45 }}
           animate={{ scale: 1, rotate: 0 }}
           className="relative z-10 mb-6 md:mb-10"
        >
          {isCorrect ? (
             <div className="bg-white p-4 md:p-6 brutal-border brutal-shadow shadow-black">
               <CheckCircle2 className="w-20 h-20 md:w-32 md:h-32 text-[#26890c]" />
             </div>
          ) : (
             <div className="bg-black p-4 md:p-6 brutal-border brutal-shadow-white shadow-white">
               <XCircle className="w-20 h-20 md:w-32 md:h-32 text-white" />
             </div>
          )}
        </motion.div>
        
        <div className="relative z-10 mb-8 p-3 bg-artistic-yellow text-black font-black uppercase text-xl md:text-2xl rotate-3 brutal-border brutal-shadow">
          {rank}. SIRADASIN
        </div>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative z-10"
        >
           <div className="flex items-center gap-4 bg-black text-white px-8 md:px-10 py-3 md:py-4 brutal-border brutal-shadow-white font-black text-xl md:text-2xl uppercase italic tracking-tighter">
             <Star className="text-artistic-yellow fill-current w-6 h-6 md:w-8 md:h-8" /> 
             {participant?.score || 0} PUAN
           </div>
        </motion.div>
      </div>
    );
  }

  if (session.status === 'finished') {
    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <Trophy className="text-yellow-400 w-24 h-24 mb-6 drop-shadow-2xl relative z-10" />
        <h2 className="text-5xl font-black text-white italic tracking-tighter mb-2">OYUN BİTTİ!</h2>
        <p className="text-white/60 font-bold text-xl uppercase mb-8">Nihai Skorun</p>
        <div className="bg-white text-[#46178f] px-12 py-6 rounded-3xl text-7xl font-black shadow-2xl mb-12">
          {participant?.score || 0}
        </div>
        <button onClick={onBack} className="text-white font-bold flex items-center gap-2 hover:underline">
           <ArrowRight className="rotate-180" /> Çıkış Yap
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#46178f] flex items-center justify-center">
       <Loader2 className="animate-spin text-white w-12 h-12" />
    </div>
  );
}
