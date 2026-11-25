import React, { useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface SpringButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function SpringButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
  disabled,
  type = 'button',
  ...rest
}: SpringButtonProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev.slice(-4), { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
    onClick?.(e);
  };

  const variantClasses: Record<NonNullable<SpringButtonProps['variant']>, string> = {
    primary:
      'bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-600/25 hover:shadow-xl hover:shadow-teal-600/30',
    secondary:
      'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-900/20 hover:shadow-xl',
    outline:
      'bg-white text-slate-800 border border-slate-200 hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50/50',
    danger:
      'bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-600/25 hover:shadow-xl',
    ghost:
      'bg-transparent text-slate-700 hover:bg-slate-100',
  };

  const sizeClasses: Record<NonNullable<SpringButtonProps['size']>, string> = {
    sm: 'min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl',
    md: 'min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-xl',
    lg: 'min-h-[48px] px-6 py-3 text-base font-semibold rounded-2xl',
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      whileHover={disabled ? undefined : { y: -2, scale: 1.025 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22 }}
      className={`group relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...(rest as Record<string, unknown>)}
    >
      {/* Subtle sheen sweep on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          initial={{ scale: 0, opacity: 0.55 }}
          animate={{ scale: 5.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ left: r.x, top: r.y }}
          className="pointer-events-none absolute w-10 h-10 -ml-5 -mt-5 rounded-full bg-white/45"
        />
      ))}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

export function ParallaxTiltCard({
  children,
  className = '',
  calm = false,
}: {
  children: React.ReactNode;
  className?: string;
  calm?: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [4, -4]), { stiffness: 220, damping: 24 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-4, 4]), { stiffness: 220, damping: 24 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (calm) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={calm ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCareIllustration({ calm }: { calm: boolean }) {
  return (
    <div className="relative w-full h-24 rounded-2xl bg-gradient-to-r from-teal-50 via-sky-50/85 to-blue-50/75 border border-teal-200/70 overflow-hidden flex items-center px-5 justify-between">
      <div className="flex items-center gap-3 z-10">
        <motion.div
          animate={calm ? undefined : { scale: [1, 1.12, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-700 to-sky-700 text-white flex items-center justify-center shadow-md shadow-teal-700/25"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 12h4l3-7 4 14 3-7h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <div>
          <p className="font-display text-sm font-bold text-slate-900">First Cure Care Navigator</p>
          <p className="text-xs text-slate-600">Voice · Chat · Nearby Maps · Specialist Match</p>
        </div>
      </div>

      {/* Animated ECG Wave */}
      <svg className="w-44 h-14 text-teal-600/70 hidden sm:block" viewBox="0 0 180 56" fill="none">
        <motion.path
          d="M0 28 H36 L48 10 L62 46 L74 18 L86 34 L98 28 H180"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0.2, opacity: 0.4 }}
          animate={
            calm
              ? { pathLength: 1, opacity: 0.8 }
              : { pathLength: [0, 1, 1], opacity: [0.3, 1, 0.3] }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
    </div>
  );
}

export function VoiceSoundWave({ active, calm }: { active: boolean; calm: boolean }) {
  const bars = [0.4, 0.9, 0.6, 1, 0.7, 0.85, 0.5];
  return (
    <div className="flex items-center justify-center gap-1.5 h-10" aria-hidden="true">
      {bars.map((peak, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-teal-500"
          animate={
            active && !calm
              ? {
                  scaleY: [0.3, peak, 0.35],
                  opacity: [0.6, 1, 0.6],
                }
              : { scaleY: 0.3, opacity: 0.45 }
          }
          transition={{
            duration: 0.7,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
          style={{ height: '32px', transformOrigin: 'center' }}
        />
      ))}
    </div>
  );
}

export function AnimatedBackdrop({ calm }: { calm: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-50">
      <div
        className={`absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-teal-200/40 blur-3xl ${
          calm ? '' : 'fc-ambient-orb'
        }`}
      />
      <div
        className={`absolute top-1/3 -left-32 w-[460px] h-[460px] rounded-full bg-sky-200/45 blur-3xl ${
          calm ? '' : 'fc-ambient-orb'
        }`}
        style={{ animationDelay: '-5s' }}
      />
      <div
        className={`absolute -bottom-32 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-100/50 blur-3xl ${
          calm ? '' : 'fc-ambient-orb'
        }`}
        style={{ animationDelay: '-9s' }}
      />

      {/* Floating geometric clinical cross particles */}
      {!calm &&
        [
          { top: '18%', left: '10%', delay: 0 },
          { top: '62%', left: '88%', delay: 2.5 },
          { top: '36%', left: '78%', delay: 4.5 },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            style={{ top: item.top, left: item.left }}
            animate={{ y: [-10, 12, -10], rotate: [0, 12, 0], opacity: [0.16, 0.32, 0.16] }}
            transition={{ duration: 8 + idx * 2, repeat: Infinity, delay: item.delay, ease: 'easeInOut' }}
            className="absolute text-teal-600/30"
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />
            </svg>
          </motion.div>
        ))}

      {/* Flowing clinical pulse wave SVG */}
      <svg
        className="absolute bottom-0 left-0 w-full h-44 opacity-[0.08] text-teal-700"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M0,96 C240,140 420,40 720,96 C1020,152 1220,48 1440,92 L1440,160 L0,160 Z"
          fill="currentColor"
          animate={
            calm
              ? undefined
              : {
                  d: [
                    'M0,96 C240,140 420,40 720,96 C1020,152 1220,48 1440,92 L1440,160 L0,160 Z',
                    'M0,84 C260,44 460,136 720,84 C980,32 1200,138 1440,80 L1440,160 L0,160 Z',
                    'M0,96 C240,140 420,40 720,96 C1020,152 1220,48 1440,92 L1440,160 L0,160 Z',
                  ],
                }
          }
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
    </div>
  );
}

export function AiMatchingRadar({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="relative w-24 h-24 flex items-center justify-center mb-5">
        {[0, 1, 2].map((ring) => (
          <motion.div
            key={ring}
            className="absolute inset-0 rounded-full border-2 border-teal-500/45"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: ring * 0.55,
              ease: 'easeOut',
            }}
          />
        ))}
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.06, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/35"
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 3v18M3 12h18" strokeLinecap="round" />
          </svg>
        </motion.div>
      </div>
      <p className="text-sm font-medium text-slate-700 max-w-sm">{label}</p>
    </div>
  );
}

export function SuccessCelebration({
  title,
  subtitle,
  reference,
}: {
  title: string;
  subtitle: string;
  reference?: string;
}) {
  const bursts = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  return (
    <div className="flex flex-col items-center text-center py-6 px-4">
      <div className="relative w-28 h-28 flex items-center justify-center mb-4">
        {bursts.map((deg, idx) => {
          const rad = (deg * Math.PI) / 180;
          const dist = idx % 2 === 0 ? 52 : 38;
          return (
            <motion.span
              key={deg}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: Math.cos(rad) * dist,
                y: Math.sin(rad) * dist,
                scale: [0, 1.35, 0],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.95, ease: 'easeOut' }}
              className={`absolute w-2.5 h-2.5 rounded-full ${
                idx % 3 === 0 ? 'bg-amber-500' : idx % 2 === 0 ? 'bg-teal-500' : 'bg-cyan-500'
              }`}
            />
          );
        })}
        <motion.div
          initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          className="w-16 h-16 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xl shadow-teal-600/35"
        >
          <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
            <motion.path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.55, delay: 0.12 }}
            />
          </svg>
        </motion.div>
      </div>
      <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1.5 max-w-md">{subtitle}</p>
      {reference && (
        <p className="font-mono-num text-xs text-teal-700 font-semibold mt-3">
          Ref: {reference}
        </p>
      )}
    </div>
  );
}
