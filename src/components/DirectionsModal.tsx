import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Bike,
  Car,
  Compass,
  ExternalLink,
  Footprints,
  MapPin,
  Navigation,
  ShieldCheck,
  X,
} from 'lucide-react';
import { getCopy } from '../i18n';
import type { Appointment, Language } from '../types';
import {
  ClinicGoogleMap,
  type RouteSummary,
  type TravelModeOption,
} from './ClinicGoogleMap';
import { SpringButton } from './MotionPrimitives';

interface DirectionsModalProps {
  appointment: Appointment;
  language: Language;
  onClose: () => void;
}

export function DirectionsModal({ appointment, language, onClose }: DirectionsModalProps) {
  const t = getCopy(language);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionState, setPermissionState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [travelMode, setTravelMode] = useState<TravelModeOption>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const requestGps = () => {
    if (!navigator.geolocation) {
      setPermissionState('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermissionState('granted');
      },
      () => {
        setPermissionState('denied');
      },
      { timeout: 7000 }
    );
  };

  const destinationQuery = encodeURIComponent(appointment.clinicAddress);
  const externalMapUrl = gpsCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${gpsCoords.lat},${gpsCoords.lng}&destination=${appointment.clinicCoordinates.lat},${appointment.clinicCoordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${destinationQuery}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 36, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 36, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-teal-600" />
            {t.directions}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
          <p className="text-sm font-bold text-slate-900">{appointment.hospitalName}</p>
          <p className="text-xs text-slate-600 flex items-start gap-1.5">
            <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>{appointment.clinicAddress}</span>
          </p>
          <p className="text-xs text-slate-500 font-mono-num">
            {t.waitTime}: ~{appointment.expectedWaitMinutes} {t.mins}
          </p>
        </div>

        {/* Travel Mode Switcher when GPS permission is granted */}
        {permissionState === 'granted' && gpsCoords && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'DRIVING' as const, icon: Car, label: language === 'ta' ? 'கார்' : 'Drive' },
                {
                  id: 'TWO_WHEELER' as const,
                  icon: Bike,
                  label: language === 'ta' ? 'இருசக்கர' : '2-Wheeler',
                },
                {
                  id: 'WALKING' as const,
                  icon: Footprints,
                  label: language === 'ta' ? 'நடை' : 'Walk',
                },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTravelMode(m.id)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      travelMode === m.id
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {routeSummary && (
              <div className="text-xs font-semibold font-mono-num text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl">
                {routeSummary.distanceKm} km · ~{routeSummary.durationMins} {t.mins}
              </div>
            )}
          </div>
        )}

        {/* Interactive Google Map with Advanced Markers & Route.computeRoutes() */}
        <ClinicGoogleMap
          clinicName={appointment.hospitalName}
          clinicAddress={appointment.clinicAddress}
          clinicCoordinates={appointment.clinicCoordinates}
          originCoordinates={permissionState === 'granted' ? gpsCoords : null}
          travelMode={travelMode}
          language={language}
          heightClass="h-64"
          onRouteComputed={setRouteSummary}
          onRouteError={setRouteError}
        />

        {routeError && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {language === 'ta'
              ? 'பாதை விவரங்களை ஏற்ற முடியவில்லை. கீழே உள்ள Google Maps இணைப்பைப் பயன்படுத்தவும்.'
              : 'Unable to calculate live route right now. You can open full turn-by-turn directions below.'}
          </p>
        )}

        {/* Permission-first GPS control */}
        <div className="space-y-2.5">
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              {permissionState === 'denied'
                ? t.gpsDeniedNote
                : permissionState === 'granted' && gpsCoords
                ? `${language === 'ta' ? 'உங்கள் GPS இருப்பிடம் செயலில்:' : 'GPS Active:'} ${gpsCoords.lat.toFixed(
                    4
                  )}, ${gpsCoords.lng.toFixed(4)}`
                : language === 'ta'
                ? 'உங்கள் அனுமதியுடன் மட்டுமே First Cure உங்கள் GPS இருப்பிடத்தைப் பயன்படுத்தும்.'
                : 'First Cure only accesses your GPS location if you explicitly tap below.'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <SpringButton variant="outline" onClick={requestGps} className="flex-1">
              <Compass className="w-4 h-4" />
              {t.allowGpsDirections}
            </SpringButton>
            <a
              href={externalMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {language === 'ta' ? 'வரைபடத்தில் திறக்கவும்' : 'Open Map Route'}
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
