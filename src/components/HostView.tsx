import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { GameSession, Participant, Question, GameStatus } from '../types';
import { Users, Play, Trophy, ArrowRight, Home, Crown, Timer, Copy, Check, Cake, Gift } from 'lucide-react';
import { Counter } from './Counter';

const MOCK_QUESTIONS = [
  {
    text: "Melis'in en sevdiği renk hangisidir?",
    options: ["Pembe", "Mavi", "Yeşil", "Lila"],
    correctIndex: 3,
    order: 0
  },
  {
    text: "Melis hangi ayda doğmuştur?",
    options: ["Ocak", "Nisan", "Mayıs", "Haziran"],
    correctIndex: 2,
    order: 1
  },
  {
    text: "Melis'in en sevdiği yemek hangisidir?",
    options: ["Pizza", "Mantı", "Sushi", "Hamburger"],
    correctIndex: 2,
    order: 2
  },
  {
    text: "Melis'in hayalindeki tatil yeri neresidir?",
    options: ["Paris", "Maldivler", "Tokyo", "New York"],
    correctIndex: 1,
    order: 3
  },
  {
    text: "Melis'in en sevdiği dizi hangisidir?",
    options: ["Friends", "How I Met Your Mother", "The Office", "Gossip Girl"],
    correctIndex: 0,
    order: 4
  }
];

const COLORS = [
  'bg-artistic-red',
  'bg-artistic-blue',
  'bg-artistic-yellow',
  'bg-green-500',
];

interface Props {
  onBack: () => void;
  key?: string;
}

export function HostView({ onBack }: Props) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (session) {
      const unsubParticipants = onSnapshot(collection(db, `game_sessions/${session.id}/participants`), (snapshot) => {
        setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant)));
      });

      const unsubSession = onSnapshot(doc(db, `game_sessions/${session.id}`), (doc) => {
        if (doc.exists()) {
          setSession({ id: doc.id, ...doc.data() } as GameSession);
        }
      });

      return () => {
        unsubParticipants();
        unsubSession();
      };
    }
  }, [session?.id]);

  useEffect(() => {
    if (session && session.status === 'playing') {
      const answeredCount = participants.filter(p => p.lastAnswer?.questionIndex === session.currentQuestionIndex).length;
      if (participants.length > 0 && answeredCount >= participants.length) {
        // Auto transition to results after a tiny delay
        setTimeout(async () => {
          try {
            await updateDoc(doc(db, `game_sessions/${session.id}`), { status: 'results' });
          } catch (e) {
            console.error("Auto transition failed", e);
          }
        }, 1500);
      }
    }
  }, [session?.status, participants, session?.currentQuestionIndex]);

  const createGame = async () => {
    if (!auth.currentUser) return;
    setCreating(true);
    try {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const sessionData = {
        pin,
        status: 'waiting' as GameStatus,
        currentQuestionIndex: 0,
        questionStartTime: null,
        hostId: auth.currentUser.uid,
        totalQuestions: MOCK_QUESTIONS.length,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'game_sessions'), sessionData);
      
      const batch = writeBatch(db);
      MOCK_QUESTIONS.forEach((q, i) => {
        const qRef = doc(collection(db, `game_sessions/${docRef.id}/questions`));
        batch.set(qRef, q);
      });
      await batch.commit();

      setSession({ id: docRef.id, ...sessionData } as any);
      
      const qSnapshot = await getDocs(collection(db, `game_sessions/${docRef.id}/questions`));
      setQuestions(qSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question)).sort((a, b) => a.order - b.order));

    } catch (error: any) {
      console.error("Game Creation Error:", error);
      alert("Oyun Başlatılamadı! Hata: " + (error.message || "Bilinmeyen hata"));
      handleFirestoreError(error, OperationType.CREATE, 'game_sessions');
    } finally {
      setCreating(false);
    }
  };

  const startGame = async () => {
    if (!session) return;
    try {
      await updateDoc(doc(db, `game_sessions/${session.id}`), {
        status: 'playing',
        questionStartTime: serverTimestamp(),
        currentQuestionIndex: 0
      });
    } catch (error: any) {
       console.error("Start Game Error:", error);
       alert("Oyun Başlatılamadı! Hata: " + (error.message || "Bilinmeyen hata"));
       handleFirestoreError(error, OperationType.UPDATE, `game_sessions/${session.id}`);
    }
  };

  const copyInviteLink = () => {
    if (!session) return;
    const url = new URL(window.location.href);
    url.searchParams.set('pin', session.pin);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nextStep = async () => {
    if (!session) return;
    try {
      if (session.status === 'playing') {
        await updateDoc(doc(db, `game_sessions/${session.id}`), { status: 'results' });
      } else if (session.status === 'results') {
        await updateDoc(doc(db, `game_sessions/${session.id}`), { status: 'leaderboard' });
      } else if (session.status === 'leaderboard') {
        const nextIndex = session.currentQuestionIndex + 1;
        if (nextIndex >= session.totalQuestions) {
          await updateDoc(doc(db, `game_sessions/${session.id}`), { status: 'finished' });
        } else {
          await updateDoc(doc(db, `game_sessions/${session.id}`), {
            status: 'playing',
            currentQuestionIndex: nextIndex,
            questionStartTime: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `game_sessions/${session.id}`);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-artistic-black p-8 flex flex-col items-center justify-center">
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-white p-10 brutal-border brutal-shadow max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-artistic-yellow brutal-border flex items-center justify-center mx-auto mb-6 transform -rotate-6">
            <Crown className="text-black w-10 h-10" />
          </div>
          <h2 className="text-4xl font-black text-black italic uppercase mb-2 tracking-tighter">Melis'in Quiz'i</h2>
          <p className="text-gray-500 font-bold mb-8">Oyuncuların katılabilmesi için bir oturum oluşturun.</p>
          <button
            onClick={createGame}
            disabled={creating}
            className="w-full bg-artistic-red text-white py-5 brutal-border brutal-shadow font-black text-2xl uppercase tracking-tighter transition-all hover:bg-black disabled:opacity-50"
          >
            {creating ? 'Hazırlanıyor...' : 'Oyun Başlat'}
          </button>
          <button onClick={onBack} className="mt-6 text-gray-400 font-bold uppercase text-xs tracking-widest hover:text-black">İptal</button>
        </motion.div>
      </div>
    );
  }

  // Waiting Room
  if (session.status === 'waiting') {
    return (
      <div className="h-screen bg-artistic-black flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <div className="h-16 md:h-24 bg-artistic-yellow border-b-4 border-black flex items-center justify-between px-6 md:px-10 text-black">
          <div className="flex flex-col">
            <span className="text-[8px] md:text-xs font-black tracking-widest uppercase opacity-60">Birthday Bash</span>
            <span className="text-xl md:text-4xl font-black italic uppercase tracking-tighter">MELIS'S B-DAY QUIZ</span>
          </div>
          <div className="flex gap-4 md:gap-8 items-center">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-black uppercase opacity-60">Join at:</span>
                <span className="text-sm md:text-xl font-black uppercase tracking-tighter">{window.location.hostname}</span>
             </div>
             <div className="bg-black text-artistic-yellow px-4 md:px-8 py-2 md:py-3 transform -skew-x-12 border-2 border-black shadow-[4px_4px_0px_rgba(255,255,255,0.2)] flex items-center gap-2 md:gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] md:text-xs block font-bold tracking-widest leading-none mb-1">PIN</span>
                  <span className="text-xl md:text-4xl font-black tracking-tighter leading-none">{session.pin}</span>
                </div>
                <button 
                  onClick={copyInviteLink}
                  className="p-1 md:p-2 hover:bg-white/10 rounded transition-colors"
                  title="Davet Linkini Kopyala"
                >
                  {copied ? <Check className="w-4 h-4 md:w-6 md:h-6 text-green-400" /> : <Copy className="w-4 h-4 md:w-6 md:h-6" />}
                </button>
             </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
          {/* Left Join Status */}
          <div className="md:col-span-4 border-b-4 md:border-b-0 md:border-r-4 border-black p-6 md:p-10 bg-artistic-red flex flex-col justify-between overflow-hidden">
            <div className="flex md:flex-col items-center md:items-start justify-between md:justify-start gap-4 md:space-y-6">
              <div className="bg-white p-2 md:p-4 inline-block transform rotate-3 brutal-border brutal-shadow">
                <div className="w-12 h-12 md:w-32 md:h-32 bg-black flex items-center justify-center">
                   <div className="grid grid-cols-4 gap-0.5 md:gap-1 p-1 md:p-2">
                     {Array.from({ length: 16 }).map((_, i) => (
                       <div key={i} className={`w-1.5 h-1.5 md:w-4 md:h-4 ${Math.random() > 0.5 ? 'bg-artistic-red' : 'bg-white'}`} />
                     ))}
                   </div>
                </div>
              </div>
              <h2 className="text-3xl md:text-6xl font-black leading-none uppercase transform -rotate-1 tracking-tighter text-black">
                Katılımcılar <span className="bg-black text-white px-2 py-0.5 md:px-3 md:py-1">Bekleniyor</span>
              </h2>
            </div>
            
            <div className="space-y-2 mt-4 md:mt-0">
              <div className="flex justify-between items-end border-b-4 border-black pb-2 md:pb-4 text-black">
                <span className="text-4xl md:text-6xl font-black">{participants.length}</span>
                <span className="text-[10px] md:text-sm font-black uppercase tracking-widest">Oyuncu Hazır</span>
              </div>
            </div>
          </div>

          {/* Right Players Grid */}
          <div className="md:col-span-8 bg-artistic-blue p-6 md:p-12 overflow-y-auto scrollbar-hide">
            <div className="flex flex-wrap gap-2 md:gap-4 content-start">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: Math.random() * 6 - 3 }}
                    className="bg-white text-black px-6 py-3 brutal-border brutal-shadow font-black uppercase tracking-tight text-xl"
                  >
                    {p.name}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="h-20 bg-black border-t-4 border-black flex items-center px-10 gap-6">
           <button 
             onClick={startGame}
             disabled={participants.length === 0}
             className="bg-white text-black px-12 py-3 font-black uppercase text-xl hover:bg-artistic-yellow transition-all disabled:opacity-30 disabled:cursor-not-allowed transform -skew-x-2"
           >
             Oyunu Başlat
           </button>
           <button onClick={onBack} className="border-2 border-white text-white px-8 py-2 font-black uppercase hover:bg-white hover:text-black transition-colors italic">İptal</button>
           
           <div className="ml-auto flex items-center gap-4">
              <span className="text-xs font-black text-gray-500 tracking-[0.3em]">LIVE SERVER: CONNECTED</span>
              <div className="w-4 h-4 bg-green-500 brutal-border animate-pulse shadow-[0_0_10px_#22c55e]"></div>
           </div>
        </div>
      </div>
    );
  }

  // Playing Question
  if (session.status === 'playing') {
    const currentQ = questions[session.currentQuestionIndex];
    if (!currentQ) return <div className="text-white p-10">Sorular yüklenemedi.</div>;

    return (
      <div className="min-h-screen bg-artistic-black flex flex-col overflow-hidden">
        <div className="bg-artistic-yellow p-6 md:p-8 border-b-4 border-black flex items-center justify-between text-black relative">
          <div className="absolute top-0 right-0 p-2 bg-black text-white text-[10px] font-black tracking-widest uppercase">
            Question {session.currentQuestionIndex + 1} / {session.totalQuestions}
          </div>
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none pr-8">{currentQ.text}</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-artistic-blue relative overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[30vw] font-black text-white/5 pointer-events-none select-none italic transform -rotate-12">
             QUIZ
           </div>
           
           <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 relative z-10">
             {currentQ.options.map((opt, i) => (
               <div key={i} className={`bg-white p-6 md:p-8 brutal-border brutal-shadow flex items-center gap-4 md:gap-6 group hover:-translate-y-1 transition-transform cursor-default ${i % 2 === 0 ? '-rotate-1 md:-rotate-1' : 'rotate-1 md:rotate-1'}`}>
                  <div className={`w-12 h-12 md:w-16 md:h-16 brutal-border flex items-center justify-center bg-black text-white text-xl md:text-3xl font-black group-hover:bg-artistic-red transition-colors`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="text-xl md:text-3xl font-black text-black uppercase tracking-tight truncate">{opt}</span>
               </div>
             ))}
           </div>
        </div>

        <div className="p-8 bg-artistic-red border-t-4 border-black flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white brutal-border rounded-full flex items-center justify-center font-black animate-bounce text-black">
               {participants.filter(p => p.lastAnswer?.questionIndex === session.currentQuestionIndex).length}
             </div>
             <span className="text-white font-black uppercase tracking-widest text-sm">Cevap Verenler</span>
          </div>
          <button onClick={nextStep} className="bg-white text-black px-12 py-5 brutal-border brutal-shadow font-black uppercase text-xl flex items-center gap-3 hover:bg-artistic-yellow transition-colors transform -rotate-1 active:translate-y-1 active:shadow-none">
             Cevapları Gör <ArrowRight />
          </button>
        </div>
      </div>
    );
  }

  // Results Screen (Current Question Stats)
  if (session.status === 'results') {
    const currentQ = questions[session.currentQuestionIndex];
    if (!currentQ) return null;

    const stats = currentQ.options.map((_, i) => ({
      index: i,
      count: participants.filter(p => p.lastAnswer?.questionIndex === session.currentQuestionIndex && p.lastAnswer.choiceIndex === i).length
    }));

    const maxCount = Math.max(...stats.map(s => s.count), 1);

    return (
      <div className="min-h-screen bg-artistic-black flex flex-col overflow-hidden relative">
        <div className="bg-artistic-yellow p-6 border-b-4 border-black flex items-center justify-between text-black relative z-10">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">{currentQ.text}</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-artistic-blue relative overflow-hidden">
           <div className="w-full max-w-5xl flex flex-col gap-8 relative z-10">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
               {currentQ.options.map((opt, i) => {
                 const isCorrect = i === currentQ.correctIndex;
                 const count = stats[i].count;
                 const percentage = (count / participants.length) * 100;
                 return (
                   <div key={i} className={`bg-white p-4 md:p-6 brutal-border brutal-shadow flex flex-col gap-2 relative ${isCorrect ? 'border-artistic-yellow ring-4 ring-artistic-yellow shadow-[4px_4px_0px_#e5a50a]' : 'opacity-40'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 brutal-border flex items-center justify-center bg-black text-white text-sm font-black`}>
                             {String.fromCharCode(65 + i)}
                           </div>
                           <span className="text-lg md:text-xl font-black text-black uppercase tracking-tight truncate max-w-[200px]">{opt}</span>
                        </div>
                        {isCorrect && (
                          <div className="bg-artistic-yellow text-black text-[10px] font-black px-2 py-1 brutal-border uppercase">Doğru Yanıt</div>
                        )}
                      </div>
                      
                      <div className="h-10 bg-gray-100 brutal-border relative overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className={`h-full ${COLORS[i % COLORS.length]}`} 
                        />
                        <span className="absolute inset-y-0 right-4 flex items-center font-black text-black">{count}</span>
                      </div>
                   </div>
                 );
               })}
             </div>
           </div>
        </div>

        <div className="p-8 bg-black border-t-4 border-black flex justify-center items-center">
          <button onClick={nextStep} className="bg-white text-black px-12 py-5 brutal-border brutal-shadow font-black uppercase text-2xl flex items-center gap-3 hover:bg-artistic-yellow transition-colors transform -rotate-1">
             Liderlik Tablosu <ArrowRight />
          </button>
        </div>
      </div>
    );
  }

  // Leaderboard
  if (session.status === 'leaderboard') {
    const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);
    return (
      <div className="min-h-screen bg-artistic-yellow flex flex-col p-4 md:p-10">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-8 md:mb-12">
            <div>
               <h1 className="text-4xl md:text-8xl font-black italic uppercase tracking-tighter leading-none text-black">SKORLAR</h1>
               <p className="text-black font-bold uppercase tracking-widest text-xs md:text-base mt-2">KİM ŞAMPİYON OLACAK?</p>
            </div>
            <div className="bg-black text-white px-4 md:px-6 py-2 md:py-3 brutal-border transform rotate-3 hidden md:block">
              <span className="font-black text-xl md:text-2xl italic">{participants.length} OYUNCU</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-3 md:gap-4 overflow-y-auto max-h-[65vh] scrollbar-hide pr-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {sortedParticipants.map((p, index) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 30,
                    layout: { duration: 0.6, type: "spring" } 
                  }}
                  className={`flex items-center gap-3 md:gap-6 p-3 md:p-5 brutal-border brutal-shadow transition-colors ${index === 0 ? 'bg-black text-white scale-[1.02] md:scale-105 z-10' : 'bg-white text-black'}`}
                >
                  <div className={`w-10 h-10 md:w-14 md:h-14 brutal-border flex items-center justify-center font-black text-xl md:text-3xl italic ${index === 0 ? 'bg-artistic-yellow text-black' : 'bg-black text-white'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg md:text-3xl font-black uppercase tracking-tight truncate max-w-[150px] md:max-w-none flex items-center gap-2">
                      {p.name} {index === 0 && <Crown className="w-5 h-5 md:w-8 md:h-8 text-artistic-yellow fill-current" />}
                    </div>
                    {index === 0 && <div className="text-[8px] md:text-xs font-bold uppercase tracking-widest opacity-60">Lider Koltuğunda!</div>}
                  </div>
                  <div className="text-2xl md:text-5xl font-black italic tracking-tighter">
                    <Counter value={p.score} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="mt-8 md:mt-12 flex justify-center pb-8">
             <button
               onClick={nextStep}
               className="group relative inline-flex items-center gap-4 bg-black text-white px-8 md:px-16 py-4 md:py-6 brutal-border brutal-shadow-white font-black text-lg md:text-3xl uppercase italic tracking-tighter hover:bg-artistic-blue transition-all active:scale-95 transform -rotate-1"
             >
               {session.currentQuestionIndex + 1 >= session.totalQuestions ? 'Final Sonuçları' : 'Sıradaki Soru'}
               <ArrowRight className="group-hover:translate-x-2 transition-transform w-6 h-6 md:w-10 md:h-10" />
             </button>
          </div>
        </div>
      </div>
    );
  }

  // Final Screen
  if (session.status === 'finished') {
    const winners = [...participants].sort((a, b) => b.score - a.score).slice(0, 3);
    return (
      <div className="min-h-screen bg-artistic-blue p-4 md:p-8 flex flex-col items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none grid grid-cols-6 md:grid-cols-12 gap-2 md:gap-4 p-4">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="aspect-square brutal-border bg-white" />
          ))}
        </div>

        <div className="relative z-10 text-center mb-8 md:mb-16">
          <h1 className="text-6xl md:text-9xl font-black text-white italic tracking-tighter mb-4 drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] md:drop-shadow-[10px_10px_0px_rgba(0,0,0,1)] uppercase">PODIUM</h1>
        </div>

        <div className="flex items-end justify-center gap-1 md:gap-2 w-full max-w-4xl px-2 md:px-4 mb-12 md:mb-20 relative z-10 max-h-[50vh]">
          {winners[1] && (
            <div className="flex-1 flex flex-col items-center">
              <div className="w-12 h-12 md:w-20 md:h-20 bg-white brutal-border mb-2 md:mb-4 flex items-center justify-center transform rotate-6">
                <span className="text-black font-black text-xl md:text-3xl italic">2</span>
              </div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto', minHeight: '120px' }}
                className="bg-black w-full flex flex-col items-center justify-start pt-4 md:pt-10 brutal-border border-t-artistic-yellow"
                style={{ height: '30vh' }}
              >
                <span className="text-artistic-yellow font-black uppercase text-xs md:text-2xl tracking-tighter italic mb-1 md:mb-2 w-full px-1 md:px-2 truncate text-center">{winners[1].name}</span>
                <span className="text-white font-mono text-[10px] md:text-lg opacity-60 uppercase">{winners[1].score} PTS</span>
              </motion.div>
            </div>
          )}

          {winners[0] && (
            <div className="flex-1 flex flex-col items-center scale-105 md:scale-110">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-artistic-yellow brutal-border mb-4 md:mb-6 flex items-center justify-center relative">
                <Crown className="absolute -top-8 md:-top-14 text-artistic-yellow w-12 h-12 md:w-20 md:h-20 drop-shadow-xl animate-bounce" />
                <span className="text-black font-black text-2xl md:text-5xl italic">1</span>
              </div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto', minHeight: '180px' }}
                className="bg-white w-full flex flex-col items-center justify-start pt-6 md:pt-12 brutal-border brutal-shadow"
                style={{ height: '40vh' }}
              >
                <span className="text-black font-black uppercase text-sm md:text-3xl tracking-widest italic mb-1 md:mb-2 w-full px-1 md:px-2 truncate text-center">{winners[0].name}</span>
                <span className="text-artistic-blue font-black text-xs md:text-xl uppercase tracking-widest">{winners[0].score} PTS</span>
              </motion.div>
            </div>
          )}

          {winners[2] && (
            <div className="flex-1 flex flex-col items-center">
              <div className="w-10 h-10 md:w-16 md:h-16 bg-white brutal-border mb-2 md:mb-4 flex items-center justify-center transform -rotate-12">
                <span className="text-black font-black text-lg md:text-2xl italic">3</span>
              </div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto', minHeight: '80px' }}
                className="bg-black w-full flex flex-col items-center justify-start pt-3 md:pt-8 brutal-border border-t-white"
                style={{ height: '20vh' }}
              >
                <span className="text-white font-black uppercase text-[10px] md:text-xl tracking-tighter italic mb-1 w-full px-1 md:px-2 truncate text-center">{winners[2].name}</span>
                <span className="text-white/40 font-mono text-[8px] md:text-sm uppercase">{winners[2].score} PTS</span>
              </motion.div>
            </div>
          )}
        </div>

        <button onClick={onBack} className="relative z-10 flex items-center gap-2 md:gap-3 text-black font-black bg-white px-6 md:px-10 py-3 md:py-5 brutal-border brutal-shadow hover:bg-artistic-yellow transition-all text-sm md:text-xl uppercase italic transform active:scale-95">
          <Home className="w-5 h-5 md:w-6 md:h-6" /> Ana Sayfa
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#46178f] flex items-center justify-center">
       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
    </div>
  );
}
