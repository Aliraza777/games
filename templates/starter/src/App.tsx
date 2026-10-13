import { motion } from 'motion/react';
import { useState } from 'react';
import { nextScore } from './game';

export function App() {
  const [score, setScore] = useState(0);
  return (
    <main className="app">
      <h1>{{title}}</h1>
      <p>Your new game starts here.</p>
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setScore((s) => nextScore(s, true))}
      >
        Score: {score}
      </motion.button>
    </main>
  );
}
