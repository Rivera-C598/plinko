import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { initPlinko, PLINKO_CONFIG, BUCKETS } from './PlinkoEngine';
import { motion, AnimatePresence } from 'motion/react';

export default function PlinkoApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ballName, setBallName] = useState('Player 1');
  const [dropCount, setDropCount] = useState(1);
  const [jackpots, setJackpots] = useState<{ id: number; name: string }[]>([]);
  const [bucketHits, setBucketHits] = useState<Record<number, number>>({});
  const engineRef = useRef<ReturnType<typeof initPlinko> | null>(null);
  const [recentWins, setRecentWins] = useState<{ id: number; name: string; multiplier: number }[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Initialize exactly once
    const engine = initPlinko(canvasRef.current, (index, multiplier, name) => {
      handleWin(index, multiplier, name);
    });
    
    engineRef.current = engine;
    
    return () => {
      engine.destroy();
    };
  }, []); // Empty dep array because we only mount once

  const handleWin = (index: number, multiplier: number, name: string) => {
    // Trigger bucket animation
    setBucketHits(prev => ({ ...prev, [index]: (prev[index] || 0) + 1 }));
    setTimeout(() => {
      setBucketHits(prev => ({ ...prev, [index]: Math.max(0, prev[index] - 1) }));
    }, 300);

    // Track recent wins for UI display
    setRecentWins(prev => {
      const newWin = { id: Date.now() + Math.random(), name, multiplier };
      const next = [newWin, ...prev].slice(0, 5); // keep last 5
      return next;
    });

    if (multiplier >= 10000) {
      triggerJackpot(name);
    }
  };

  const handleDrop = () => {
    let count = 0;
    const interval = setInterval(() => {
      if (count >= dropCount) {
        clearInterval(interval);
        return;
      }
      engineRef.current?.dropBall(ballName);
      count++;
    }, 200); // 200ms delay between multiple drops
  };

  const triggerJackpot = (name: string) => {
    const jackpotId = Date.now() + Math.random();
    setJackpots(prev => [...prev, { id: jackpotId, name }]);
    setTimeout(() => {
      setJackpots(prev => prev.filter(j => j.id !== jackpotId));
    }, 5000);

    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFE100', '#FFB400', '#ffffff']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFE100', '#FFB400', '#ffffff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#0E1520] text-white p-4 font-sans">
      <div className="flex justify-between items-center w-full max-w-4xl px-8 py-4 mb-4 bg-white/5 border border-white/10 rounded-2xl shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="text-gray-400 font-medium mr-2">BALL NAME</div>
          <input 
            type="text" 
            value={ballName}
            onChange={(e) => setBallName(e.target.value)}
            className="w-32 bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-green-400 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-4">
            <div className="text-gray-400 font-medium mr-2">BALLS</div>
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                <button 
                  onClick={() => setDropCount(Math.max(1, dropCount - 1))}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                >-</button>
                <input 
                  type="number" 
                  value={dropCount}
                  onChange={(e) => setDropCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-transparent text-center font-bold outline-none"
                />
                <button 
                  onClick={() => setDropCount(dropCount + 1)}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                >+</button>
                <button 
                  onClick={() => setDropCount(dropCount + 10)}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md transition-colors ml-1"
                >+10</button>
            </div>
            
            <button 
                onClick={handleDrop}
                className="ml-4 px-8 py-3 bg-gradient-to-r from-[#00D09C] to-[#00A87A] text-white font-bold rounded-xl
                         hover:shadow-[0_0_20px_#00D09C55] active:scale-95 transition-all shadow-lg"
            >
                DROP BALL
            </button>
        </div>
      </div>

      <div className="relative flex justify-center items-start w-full mx-auto">
        {/* Main Game Area */}
        <div className="relative border-4 border-white/5 bg-[#0a1017] rounded-3xl overflow-hidden shadow-2xl shrink-0">
          <canvas ref={canvasRef} width={PLINKO_CONFIG.width} height={PLINKO_CONFIG.height} className="block" />
          
          {/* Bucket HTML Overlay for better styling */}
          <div className="absolute left-0 right-0 flex justify-center pointer-events-none" 
               style={{ 
                   bottom: '60px', // Align vertical position roughly matching the peg bottoms
               }}>
               <div className="flex h-14" style={{
                   width: PLINKO_CONFIG.pegDensity * 17 + 8, 
               }}>
                   {BUCKETS.map((b, i) => {
                      const isHit = bucketHits[i] > 0;
                      return (
                        <motion.div 
                            key={i} 
                            animate={{ 
                                scale: isHit ? 1.25 : 1, 
                                y: isHit ? 10 : 0, 
                                filter: isHit ? 'brightness(1.5)' : 'brightness(1)',
                                zIndex: isHit ? 20 : 10
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                            className="flex-1 flex flex-col items-center justify-center font-black text-[0.8rem] rounded-lg border-t-2 border-b-4 relative overflow-hidden cursor-default tracking-tighter"
                            style={{ 
                               backgroundColor: `${b.color}EE`,
                               color: '#1a1a1a',
                               borderColor: '#00000044',
                               borderTopColor: '#FFFFFF66',
                               boxShadow: `inset 0 4px 0 rgba(255,255,255,0.4), inset 0 -4px 0 rgba(0,0,0,0.3), 0 5px 15px rgba(0,0,0,0.6)`,
                               margin: '0 2px',
                               textShadow: '0 1px 1px rgba(255,255,255,0.8)'
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                            <span className="relative z-10">{b.label}</span>
                        </motion.div>
                      );
                   })}
               </div>
          </div>

          {/* Jackpot Overlay */}
          <AnimatePresence>
            {jackpots.length > 0 && (
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 flex flex-col items-center justify-center gap-8 pointer-events-none z-50 bg-black/60 backdrop-blur-sm p-4 overflow-hidden"
              >
                <AnimatePresence>
                  {jackpots.map((jackpot) => (
                    <motion.div 
                      key={jackpot.id}
                      initial={{ scale: 0.5, y: 100, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      className="text-center"
                    >
                      <motion.h1 
                          animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
                          transition={{ repeat: Infinity, duration: 0.5 }}
                          className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FFE100] to-[#FF7000] drop-shadow-[0_0_30px_rgba(255,225,0,0.8)] mb-2"
                      >
                        10K JACKPOT!
                      </motion.h1>
                      <div className="text-2xl text-white font-bold drop-shadow-md">
                        {jackpot.name} WON BIG!
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating win amounts History Column */}
        <div className="absolute left-[calc(50%+420px)] w-72 flex flex-col gap-2 shrink-0">
            <h2 className="text-gray-400 font-bold mb-2 uppercase tracking-widest text-sm">Recent Wins</h2>
            <AnimatePresence>
                {recentWins.map((win) => (
                    <motion.div 
                        key={win.id}
                        initial={{ opacity: 0, x: 50, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="px-4 py-3 rounded-xl bg-[#151c27] border border-white/5 shadow-lg flex justify-between items-center"
                    >
                        <span className="font-semibold text-gray-300 truncate max-w-[120px]">{win.name}</span>
                        <span className="text-green-400 font-bold">{win.multiplier}x</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
