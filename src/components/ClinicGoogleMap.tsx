import React, { useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type { Language } from '../types';

export type TravelModeOption = 'DRIVING' | 'TWO_WHEELER' | 'WALKING';

export interface RouteSummary {
  distanceKm: string;
  durationMins: number;
}

interface ClinicGoogleMapProps {
  clinicName: string;
  clinicAddress: string;
  clinicCoordinates: { lat: number; lng: number };
  originCoordinates?: { lat: number; lng: number } | null;
  travelMode?: TravelModeOption;
  language: Language;
  heightClass?: string;
  onRouteComputed?: (summary: RouteSummary | null) => void;
  onRouteError?: (err: string | null) => void;
}

let cachedServerKey: string | null = null;

function useMapsApiKey(): { apiKey: string; resolving: boolean } {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const [apiKey, setApiKey] = useState<string>(envKey || cachedServerKey || '');
  const [resolving, setResolving] = useState<boolean>(!envKey && cachedServerKey === null);

  useEffect(() => {
    if (envKey) {
      setApiKey(envKey);
      setResolving(false);
      return;
    }
    if (cachedServerKey !== null) {
      setApiKey(cachedServerKey);
      setResolving(false);
      return;
    }
    let active = true;
    fetch('/api/maps/client-config')
      .then((res) => res.json())
      .then((data: { apiKey?: string }) => {
        const resolved = typeof data.apiKey === 'string' ? data.apiKey : '';
        cachedServerKey = resolved;
        if (active) {
          setApiKey(resolved);
          setResolving(false);
        }
      })
      .catch(() => {
        cachedServerKey = '';
        if (active) setResolving(false);
      });
    return () => {
      active = false;
    };
  }, [envKey]);

  return { apiKey, resolving };
}

function MapsQuotaMonitor() {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  return null;
}

interface RoutePolylineHandle {
  setOptions: (opts: { strokeColor?: string; strokeWeight?: number; strokeOpacity?: number }) => void;
  setMap: (map: ReturnType<typeof useMap> | null) => void;
}

function RoutePolylineLayer({
  origin,
  destination,
  travelMode,
  onRouteComputed,
  onRouteError,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  travelMode: TravelModeOption;
  onRouteComputed?: (summary: RouteSummary | null) => void;
  onRouteError?: (err: string | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<RoutePolylineHandle[]>([]);

  useEffect(() => {
    if (!map || !routesLib) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    onRouteError?.(null);

    let cancelled = false;

    const routeClass = (
      routesLib as unknown as {
        Route?: {
          computeRoutes: (req: Record<string, unknown>) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: Parameters<NonNullable<typeof map>['fitBounds']>[0];
              createPolylines: () => RoutePolylineHandle[];
            }>;
          }>;
        };
      }
    ).Route;

    if (!routeClass || typeof routeClass.computeRoutes !== 'function') {
      return;
    }

    routeClass
      .computeRoutes({
        origin,
        destination,
        travelMode,
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      })
      .then((response) => {
        if (cancelled) return;
        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          onRouteComputed?.(null);
          return;
        }

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#0d9488',
            strokeWeight: 6,
            strokeOpacity: 0.9,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distanceKm = ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1);
        const durationMins = Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000));
        onRouteComputed?.({ distanceKm, durationMins });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('OVER_QUERY_LIMIT') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteComputed?.(null);
        onRouteError?.(message);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin.lat, origin.lng, destination.lat, destination.lng, travelMode]);

  return null;
}

export function ClinicGoogleMap({
  clinicName,
  clinicAddress,
  clinicCoordinates,
  originCoordinates,
  travelMode = 'DRIVING',
  language,
  heightClass = 'h-60',
  onRouteComputed,
  onRouteError,
}: ClinicGoogleMapProps) {
  const { apiKey, resolving } = useMapsApiKey();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  if (resolving) {
    return (
      <div
        className={`w-full ${heightClass} rounded-2xl bg-slate-100 border border-slate-200 animate-pulse flex items-center justify-center text-xs text-slate-500`}
      >
        {language === 'ta' ? 'வரைபடம் ஏற்றப்படுகிறது...' : 'Loading interactive Google Map...'}
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div
        className={`w-full ${heightClass} rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-4 text-center`}
      >
        <p className="text-xs font-semibold text-slate-800">{clinicName}</p>
        <p className="text-[11px] text-slate-600 mt-1">{clinicAddress}</p>
        <p className="font-mono-num text-[11px] text-teal-700 mt-2">
          {clinicCoordinates.lat.toFixed(4)}, {clinicCoordinates.lng.toFixed(4)}
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200`}>
      <APIProvider
        apiKey={apiKey}
        language={language}
        region="IN"
        libraries={['marker', 'routes']}
      >
        <MapsQuotaMonitor />
        <GoogleMapView
          mapId="DEMO_MAP_ID"
          defaultCenter={clinicCoordinates}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker
            ref={markerRef}
            position={clinicCoordinates}
            title={clinicName}
            onClick={() => setInfoOpen(true)}
          >
            <Pin background="#0d9488" borderColor="#115e59" glyphColor="#ffffff" scale={1.15} />
          </AdvancedMarker>

          {infoOpen && marker && (
            <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)} maxWidth={230}>
              <div className="p-1">
                <p className="text-xs font-bold text-slate-900">{clinicName}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{clinicAddress}</p>
              </div>
            </InfoWindow>
          )}

          {originCoordinates && (
            <>
              <AdvancedMarker
                position={originCoordinates}
                title={language === 'ta' ? 'உங்கள் இடம்' : 'Your Location'}
              >
                <Pin background="#0f172a" borderColor="#334155" glyphColor="#ffffff" scale={0.95} />
              </AdvancedMarker>
              <RoutePolylineLayer
                origin={originCoordinates}
                destination={clinicCoordinates}
                travelMode={travelMode}
                onRouteComputed={onRouteComputed}
                onRouteError={onRouteError}
              />
            </>
          )}
        </GoogleMapView>
      </APIProvider>
    </div>
  );
}
