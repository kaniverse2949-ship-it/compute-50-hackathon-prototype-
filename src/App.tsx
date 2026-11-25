/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { signOutFirebase } from './lib/firebase';
import { AnimatedBackdrop } from './components/MotionPrimitives';
import { OnboardingFlow } from './components/OnboardingFlow';
import { PatientWorkspace } from './components/PatientWorkspace';
import { DoctorWorkspace } from './components/DoctorWorkspace';
import type { Language, PublicUser } from './types';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [calmMotion, setCalmMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [largeText, setLargeText] = useState<boolean>(false);

  // Session token kept strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const handleAuthenticated = (nextToken: string, nextUser: PublicUser) => {
    setToken(nextToken);
    setUser(nextUser);
    setLanguage(nextUser.preferredLanguage || language);
  };

  const handleSignOut = () => {
    void signOutFirebase();
    setToken(null);
    setUser(null);
  };

  const rootClassName = [
    'min-h-screen',
    calmMotion ? 'fc-calm-motion' : '',
    largeText ? 'fc-text-large' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <MotionConfig reducedMotion={calmMotion ? 'always' : 'user'}>
      <div className={rootClassName}>
        {mapsQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <AnimatedBackdrop calm={calmMotion} />

        {!token || !user ? (
          <OnboardingFlow
            language={language}
            onSelectLanguage={setLanguage}
            calmMotion={calmMotion}
            onToggleCalmMotion={() => setCalmMotion((c) => !c)}
            largeText={largeText}
            onToggleLargeText={() => setLargeText((v) => !v)}
            onAuthenticated={handleAuthenticated}
          />
        ) : user.role === 'doctor' ? (
          <DoctorWorkspace
            token={token}
            user={user}
            language={language}
            calmMotion={calmMotion}
            onUpdateUser={setUser}
            onToggleCalmMotion={() => setCalmMotion((c) => !c)}
            onSignOut={handleSignOut}
          />
        ) : (
          <PatientWorkspace
            token={token}
            user={user}
            language={language}
            onChangeLanguage={setLanguage}
            calmMotion={calmMotion}
            onUpdateUser={setUser}
            onToggleCalmMotion={() => setCalmMotion((c) => !c)}
            largeText={largeText}
            onToggleLargeText={() => setLargeText((v) => !v)}
            onSignOut={handleSignOut}
          />
        )}
      </div>
    </MotionConfig>
  );
}
