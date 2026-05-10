import { motion } from 'motion/react';
import { Play, Users, Trophy } from 'lucide-react';

interface Props {
  onHost: () => void;
  onJoin: () => void;
  key?: string;
}

export function LandingPage({ onHost, onJoin }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-artistic-black overflow-hidden relative">
      {/* Decorative skewed backgrounds */}
      <div className="absolute top-0 left-0 w-full h-32 bg-artistic-yellow border-b-4 border-black -skew-y-2 origin-top-left -z-10" />
      <div className="absolute bottom-0 right-0 w-full h-32 bg-artistic-red border-t-4 border-black skew-y-2 origin-bottom-right -z-10" />
      
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-16 relative"
      >
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-artistic-blue text-white px-4 py-1 text-xs font-black tracking-widest uppercase border-2 border-black transform -rotate-3">
          Happy Birthday Melis!
        </div>
        <h1 className="text-5xl md:text-9xl font-black text-artistic-yellow italic tracking-tighter uppercase drop-shadow-[3px_3px_0px_rgba(0,0,0,1)] md:drop-shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col">
          <span className="leading-none">MELIS'IN</span>
          <span className="leading-none text-artistic-red">QUIZ'I</span>
        </h1>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-8 w-full max-w-2xl relative z-10">
        <motion.button
          whileHover={{ scale: 1.05, rotate: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onJoin}
          className="flex-1 bg-white text-black py-10 px-12 brutal-border brutal-shadow flex flex-col items-center justify-center gap-4 transition-colors hover:bg-artistic-yellow group"
        >
          <div className="p-4 bg-artistic-red brutal-border group-hover:bg-black group-hover:text-white transition-colors">
            <Play className="w-12 h-12 fill-current" />
          </div>
          <span className="text-3xl font-black uppercase italic tracking-tight">Katıl</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onHost}
          className="flex-1 bg-artistic-blue text-white py-10 px-12 brutal-border brutal-shadow-white flex flex-col items-center justify-center gap-4 transition-colors hover:bg-artistic-red group"
        >
          <div className="p-4 bg-white text-black brutal-border">
            <Users className="w-12 h-12" />
          </div>
          <span className="text-3xl font-black uppercase italic tracking-tight">Host Ol</span>
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-20 flex items-center gap-2 text-white/40"
      >
        <Trophy className="w-5 h-5" />
        <span className="text-xs font-black uppercase tracking-[0.2em]">© 2026 Melis's Special Day</span>
      </motion.div>
    </div>
  );
}
