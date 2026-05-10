import { useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

export function Counter({ value }: { value: number }) {
  // Higher damping prevents overshooting (bounce back from 1001 to 1000)
  const springValue = useSpring(0, { stiffness: 150, damping: 25, restDelta: 0.001 });
  const displayValue = useTransform(springValue, (v) => Math.floor(v).toLocaleString());

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return <motion.span>{displayValue}</motion.span>;
}
