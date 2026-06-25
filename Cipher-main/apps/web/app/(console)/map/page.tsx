"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, MapPin, Radar, Route } from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { categoryColor, hexToRgba } from "@/lib/colors";
import type { MapRoute, MapRoutesResponse } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Signal = { city: string; latitude: number; longitude: number; total_signals: number; high_risk_signals: number; max_risk: number; top_category: string };
type CityPoint = Signal & { latitude: number; longitude: number };

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 560;
const MAP_BOUNDS = { minLon: 45.2, maxLon: 88.6, minLat: 40.2, maxLat: 56.4 };

const CITY_COORDINATES: Array<{ city: string; latitude: number; longitude: number }> = [
  { city: "Актау", latitude: 43.65, longitude: 51.1667 },
  { city: "Актобе", latitude: 50.2839, longitude: 57.167 },
  { city: "Алматы", latitude: 43.238949, longitude: 76.889709 },
  { city: "Астана", latitude: 51.160523, longitude: 71.470356 },
  { city: "Атырау", latitude: 47.1167, longitude: 51.8833 },
  { city: "Караганда", latitude: 49.806, longitude: 73.085 },
  { city: "Костанай", latitude: 53.2144, longitude: 63.6246 },
  { city: "Кызылорда", latitude: 44.8488, longitude: 65.4823 },
  { city: "Павлодар", latitude: 52.287, longitude: 76.967 },
  { city: "Петропавл", latitude: 54.8728, longitude: 69.143 },
  { city: "Семей", latitude: 50.4111, longitude: 80.2275 },
  { city: "Тараз", latitude: 42.9, longitude: 71.3667 },
  { city: "Туркестан", latitude: 43.29733, longitude: 68.25175 },
  { city: "Уральск", latitude: 51.2278, longitude: 51.3865 },
  { city: "Усть-Каменогорск", latitude: 49.9483, longitude: 82.6275 },
  { city: "Шымкент", latitude: 42.341684, longitude: 69.590101 }
];

const KAZAKHSTAN_GEOJSON: { type: "Feature"; geometry: { type: "Polygon"; coordinates: Array<Array<[number, number]>> } } = {
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[
      [46.48, 49.05], [46.92, 48.62], [47.22, 47.98], [47.68, 47.48], [48.15, 46.86], [48.73, 46.38], [49.12, 45.74], [49.55, 44.98], [50.15, 44.50], [50.62, 43.83], [51.07, 43.24], [51.46, 42.58], [52.34, 42.26], [53.33, 42.18], [54.13, 41.74], [55.24, 41.37], [56.48, 41.28], [57.58, 41.88], [58.58, 42.34], [59.72, 42.22], [60.82, 41.94], [61.95, 42.12], [63.04, 42.46], [64.34, 42.12], [65.54, 41.68], [66.82, 41.10], [68.12, 40.74], [69.34, 40.58], [70.42, 40.82], [71.46, 41.22], [72.34, 41.68], [73.26, 42.04], [74.32, 42.26], [75.58, 42.58], [76.62, 42.88], [77.82, 42.74], [78.88, 42.56], [79.92, 42.82], [80.66, 43.48], [80.44, 44.20], [81.18, 44.72], [82.20, 45.02], [83.16, 45.38], [84.12, 46.12], [84.92, 46.78], [85.76, 47.42], [86.48, 48.28], [87.42, 49.00], [86.42, 49.58], [85.26, 49.88], [84.34, 50.34], [83.18, 50.66], [82.04, 50.52], [80.96, 50.16], [79.76, 50.78], [78.82, 51.28], [77.94, 51.88], [77.06, 52.54], [76.04, 53.02], [75.18, 53.58], [74.72, 54.12], [73.42, 54.22], [72.46, 54.74], [71.26, 55.20], [70.12, 55.66], [68.88, 55.44], [67.82, 54.92], [66.68, 54.76], [65.44, 54.52], [64.18, 54.58], [62.96, 54.18], [61.82, 53.82], [60.52, 53.62], [59.28, 53.26], [58.10, 53.52], [57.04, 53.96], [55.86, 54.18], [54.70, 53.78], [53.74, 53.16], [52.84, 52.58], [51.92, 51.96], [50.88, 51.62], [49.86, 51.42], [48.78, 51.30], [47.72, 50.76], [46.92, 50.02], [46.48, 49.05]
    ]]
  }
};

const LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor?: "start" | "middle" | "end" }> = {
  "Актау": { dx: 10, dy: 18 },
  "Атырау": { dx: -12, dy: -14, anchor: "end" },
  "Уральск": { dx: -12, dy: -12, anchor: "end" },
  "Актобе": { dx: 10, dy: -14 },
  "Костанай": { dx: 8, dy: -16 },
  "Петропавл": { dx: 10, dy: -12 },
  "Астана": { dx: 10, dy: -14 },
  "Караганда": { dx: 10, dy: 18 },
  "Павлодар": { dx: 10, dy: -12 },
  "Семей": { dx: 10, dy: 16 },
  "Усть-Каменогорск": { dx: -12, dy: 20, anchor: "end" },
  "Кызылорда": { dx: -12, dy: 18, anchor: "end" },
  "Туркестан": { dx: -14, dy: -20, anchor: "end" },
  "Шымкент": { dx: -14, dy: 22, anchor: "end" },
  "Тараз": { dx: 12, dy: 28 },
  "Алматы": { dx: 14, dy: -22 }
};

const CATEGORY_LABELS: Record<string, string> = {
  suspected_illicit_vape_sales: "Vape sales",
  suspected_drop_account_recruitment: "Drop accounts",
  suspected_crypto_fraud: "Crypto fraud",
  suspected_database_leak: "Data leak",
  suspected_payment_fraud: "Payment fraud",
  hidden_identity_link: "Hidden link"
};

function project(latitude: number, longitude: number) {
  const x = ((longitude - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * MAP_WIDTH;
  const y = ((MAP_BOUNDS.maxLat - latitude) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * MAP_HEIGHT;
  return { x: Math.min(MAP_WIDTH - 24, Math.max(24, x)), y: Math.min(MAP_HEIGHT - 24, Math.max(24, y)) };
}

function countryPath() {
  return KAZAKHSTAN_GEOJSON.geometry.coordinates[0].map(([lon, lat], index) => {
    const point = project(lat, lon);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function routePath(route: MapRoute) {
  const start = project(route.from_latitude, route.from_longitude);
  const end = project(route.to_latitude, route.to_longitude);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const curve = Math.min(130, Math.max(42, length * 0.22));
  const control = {
    x: (start.x + end.x) / 2 - (dy / length) * curve,
    y: (start.y + end.y) / 2 + (dx / length) * curve
  };
  return `M${start.x.toFixed(1)} ${start.y.toFixed(1)} Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function MapPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("relative min-h-0 overflow-hidden rounded-lg border border-slate-border bg-slate-surface/80 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-md", className)}>
      <div className="relative z-10 flex h-full min-h-0 flex-col">{children}</div>
    </section>
  );
}

function PanelHeader({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-ink-primary">{title}</h2>
        {detail ? <p className="mt-1 truncate text-xs text-ink-secondary">{detail}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function severityVariant(severity: MapRoute["severity"]) {
  if (severity === "CRITICAL") return "destructive";
  if (severity === "HIGH") return "warning";
  if (severity === "MEDIUM") return "default";
  return "outline";
}

function routeLabel(route: MapRoute) {
  return `${route.from_city} -> ${route.to_city}`;
}

export default function KazakhstanMapPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [routeDiagnostics, setRouteDiagnostics] = useState<MapRoutesResponse["diagnostics"] | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hoverRouteId, setHoverRouteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  useEffect(() => {
    Promise.all([api.mapSignals(), api.mapRoutes()]).then(([signalItems, routePayload]) => {
      setSignals(signalItems);
      setRoutes(routePayload.routes);
      setRouteDiagnostics(routePayload.diagnostics);
      setSelectedCity(signalItems[0]?.city ?? CITY_COORDINATES[0].city);
      setSelectedRouteId(routePayload.routes[0]?.id ?? null);
    });
  }, []);

  const signalByCity = useMemo(() => new Map(signals.map((signal) => [signal.city, signal])), [signals]);
  const cityPoints = useMemo<CityPoint[]>(() => CITY_COORDINATES.map((city) => ({
    ...city,
    total_signals: signalByCity.get(city.city)?.total_signals ?? 0,
    high_risk_signals: signalByCity.get(city.city)?.high_risk_signals ?? 0,
    max_risk: signalByCity.get(city.city)?.max_risk ?? 0,
    top_category: signalByCity.get(city.city)?.top_category ?? "unclassified"
  })), [signalByCity]);

  const categories = useMemo(() => Array.from(new Set([...signals.map((signal) => signal.top_category), ...routes.map((route) => route.category)])).filter(Boolean).sort(), [signals, routes]);
  const filteredRoutes = useMemo(() => routes.filter((route) => {
    if (categoryFilter !== "all" && route.category !== categoryFilter) return false;
    if (severityFilter !== "all" && route.severity !== severityFilter) return false;
    return true;
  }), [routes, categoryFilter, severityFilter]);
  const top = useMemo(() => [...cityPoints].filter((signal) => signal.total_signals > 0).sort((a, b) => b.max_risk - a.max_risk).slice(0, 8), [cityPoints]);
  const selectedCitySignal = cityPoints.find((signal) => signal.city === selectedCity) ?? cityPoints[0];
  const activeRoute = filteredRoutes.find((route) => route.id === (hoverRouteId ?? selectedRouteId)) ?? filteredRoutes[0] ?? null;

  function openRoute(route: MapRoute) {
    setSelectedRouteId(route.id);
    const params = new URLSearchParams({ city_from: route.from_city, city_to: route.to_city, category: route.category, q: `${route.from_city} ${route.to_city} ${route.category}` });
    router.push(`/threats?${params.toString()}`);
  }

  return (
    <div className="map-page relative -m-4 h-[calc(100dvh-4rem)] overflow-hidden bg-slate-base p-3 text-ink-primary lg:-m-5 lg:p-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0D1117_0%,#161B22_54%,#0D1117_100%)]" />
      <div className="map-page-grid relative z-10 grid h-full min-h-0 grid-rows-[48px_minmax(0,1fr)] gap-3 overflow-hidden">
        <div className="grid min-h-0 grid-cols-[minmax(230px,1fr)_repeat(4,minmax(150px,180px))] items-center gap-3 overflow-hidden">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 border-signal-info/30 bg-signal-info/10 text-signal-accent">Map</Badge>
              <h1 className="truncate text-base font-semibold uppercase tracking-[0.18em] text-ink-primary">Kazakhstan Flow Map</h1>
            </div>
            <p className="mt-1 truncate text-xs text-ink-secondary">Geo-projected city signals and item-derived route paths.</p>
          </div>
          <Select className="w-full" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </Select>
          <Select className="w-full" defaultValue="30"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></Select>
          <Select className="w-full" defaultValue="all"><option value="all">All sources</option><option>web</option><option>telegram</option><option>manual_upload</option></Select>
          <Select className="w-full" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="all">All severity</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></Select>
        </div>

        <div className="map-content flex h-full min-h-0 overscroll-contain overflow-hidden">
          <MapPanel className="map-container h-full flex-1">
            <PanelHeader title="Global flow" detail={routeDiagnostics ? `${routeDiagnostics.multi_city_items} multi-city items / ${routeDiagnostics.route_source.replace("_", " ")} routes` : "Real Kazakhstan outline, city coordinates, and observed route paths."} action={<Badge variant="outline" className="font-mono">{filteredRoutes.length} routes</Badge>} />
            <div className="relative min-h-0 flex-1 overflow-hidden p-3">
              <div className="relative h-full w-full overscroll-contain overflow-hidden rounded-lg border border-slate-border bg-[#070b14] shadow-inner">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(47,129,247,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(47,129,247,0.04)_1px,transparent_1px)] bg-[size:34px_34px]" />
                <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="Kazakhstan threat route map" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    <radialGradient id="cityPulse"><stop offset="0%" stopColor="#79C0FF" stopOpacity="0.72" /><stop offset="100%" stopColor="#79C0FF" stopOpacity="0" /></radialGradient>
                    <filter id="cityGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    <pattern id="countryGrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#2F81F7" strokeOpacity="0.08" strokeWidth="1" /></pattern>
                    <clipPath id="countryClip"><path d={countryPath()} /></clipPath>
                    {filteredRoutes.map((route) => {
                      const start = project(route.from_latitude, route.from_longitude);
                      const end = project(route.to_latitude, route.to_longitude);
                      const color = categoryColor(route.category);
                      return <linearGradient key={`gradient-${route.id}`} id={`routeGradient-${route.id.replace(/[^a-zA-Z0-9]/g, "-")}`} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}><stop offset="0%" stopColor={hexToRgba(color, 0.08)} /><stop offset="55%" stopColor={hexToRgba(color, 0.45)} /><stop offset="100%" stopColor={color} /></linearGradient>;
                    })}
                  </defs>
                  <path d={countryPath()} fill="#141922" stroke="#30363D" strokeWidth="2" />
                  <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#countryGrid)" clipPath="url(#countryClip)" />
                  <path d={countryPath()} fill="none" stroke="#79C0FF" strokeOpacity="0.22" strokeWidth="1.2" />
                  {filteredRoutes.map((route) => {
                    const selected = route.id === selectedRouteId;
                    const hovered = route.id === hoverRouteId;
                    const active = selected || hovered;
                    const color = categoryColor(route.category);
                    const width = Math.min(8, 1.2 + Math.sqrt(route.signal_count) * 1.8);
                    return (
                      <g key={route.id}>
                        <path d={routePath(route)} fill="none" stroke={`url(#routeGradient-${route.id.replace(/[^a-zA-Z0-9]/g, "-")})`} strokeOpacity={active ? 0.95 : 0.42} strokeWidth={active ? width + 2 : width} strokeLinecap="round" filter={active ? "url(#routeGlow)" : undefined} className="cursor-pointer transition-opacity" onMouseEnter={() => setHoverRouteId(route.id)} onMouseLeave={() => setHoverRouteId(null)} onClick={() => openRoute(route)}>
                          <title>{routeLabel(route)} / {route.category} / {route.signal_count} signals / {route.route_source ?? "co_mentioned"}</title>
                        </path>
                        {active ? <path d={routePath(route)} fill="none" stroke="#F0F6FC" strokeOpacity="0.82" strokeWidth={Math.max(2, width - 1)} strokeLinecap="round" pointerEvents="none" /> : null}
                      </g>
                    );
                  })}
                  {cityPoints.map((city) => {
                    const point = project(city.latitude, city.longitude);
                    const markerColor = categoryColor(city.top_category);
                    const active = city.city === selectedCity || city.city === activeRoute?.from_city || city.city === activeRoute?.to_city;
                    const radius = city.total_signals ? Math.min(14, 5 + city.total_signals * 0.55) : 4;
                    const label = LABEL_OFFSETS[city.city] ?? { dx: 10, dy: -10 };
                    const labelX = point.x + label.dx;
                    const labelY = point.y + label.dy;
                    return (
                      <g key={city.city} className="cursor-pointer" onClick={() => setSelectedCity(city.city)}>
                        {active ? <circle cx={point.x} cy={point.y} r={radius + 14} fill="url(#cityPulse)" opacity="0.46" /> : null}
                        <circle cx={point.x} cy={point.y} r={radius + Math.max(7, city.max_risk / 12)} fill={hexToRgba(markerColor, city.total_signals ? 0.18 : 0.06)} filter="url(#cityGlow)" />
                        <line x1={point.x} y1={point.y} x2={labelX - (label.anchor === "end" ? -5 : 5)} y2={labelY - 4} stroke="#8B949E" strokeOpacity="0.32" strokeWidth="1" />
                        <circle cx={point.x} cy={point.y} r={radius} fill="#0D1117" stroke={markerColor} strokeWidth={active ? 3 : 2} />
                        <circle cx={point.x} cy={point.y} r="2.5" fill={markerColor} />
                        <text x={labelX} y={labelY} fill={active ? "#E6EDF3" : "#8B949E"} fontSize="11" fontFamily="monospace" textAnchor={label.anchor ?? "start"} paintOrder="stroke" stroke="#070b14" strokeWidth="3" strokeLinejoin="round">{city.city}</text>
                      </g>
                    );
                  })}
                </svg>

                <div className="absolute left-5 top-5 flex max-w-[calc(100%-40px)] items-center gap-2 rounded-md border border-slate-border bg-slate-base/70 px-3 py-2 font-mono text-xs uppercase tracking-wider text-signal-accent backdrop-blur">
                  <Radar className="size-4 shrink-0 text-signal-accent" />
                  <span className="truncate">KZ geospatial intelligence layer</span>
                </div>

                <div className="absolute bottom-5 left-5 w-56 rounded-md border border-slate-border bg-slate-base/80 p-3 backdrop-blur">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Category legend</div>
                  <div className="grid gap-2 text-xs text-ink-secondary">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => <div key={key} className="flex items-center gap-2"><span className="h-0.5 w-8 rounded-full" style={{ backgroundColor: categoryColor(key) }} /><span className="truncate">{label}</span></div>)}
                  </div>
                </div>

                {activeRoute ? (
                  <div className="absolute bottom-5 right-5 w-72 rounded-md border border-slate-border bg-slate-base/85 p-3 backdrop-blur">
                    <div className="flex items-center justify-between gap-3"><span className="truncate font-mono text-xs uppercase text-ink-primary">{routeLabel(activeRoute)}</span><Badge variant={severityVariant(activeRoute.severity)}>{activeRoute.severity}</Badge></div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-secondary"><span className="truncate">{activeRoute.category}</span><span className="font-mono">{activeRoute.signal_count} signals</span></div>
                  </div>
                ) : filteredRoutes.length === 0 ? (
                  <div className="absolute bottom-5 right-5 w-80 rounded-md border border-slate-border bg-slate-base/85 p-3 text-xs leading-5 text-ink-secondary backdrop-blur">No observed route paths for the active filters. Diagnostics confirm no multi-city item or sequence route is available.</div>
                ) : null}
              </div>
            </div>
          </MapPanel>

          <aside className="city-details-panel ml-3 h-full w-[390px] shrink-0 overscroll-contain overflow-hidden">
            <div className="grid h-full min-h-0 gap-3 [grid-template-rows:auto_minmax(0,1fr)_minmax(160px,220px)]">
              <MapPanel>
                <PanelHeader title="City details" detail="Aggregated from extracted city entities." />
                <div className="min-h-0 p-4">
                  {selectedCitySignal ? (
                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex items-center justify-between gap-3"><span className="truncate text-lg font-semibold text-ink-primary">{selectedCitySignal.city}</span><RiskBadge score={selectedCitySignal.max_risk} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-slate-border bg-slate-base/30 p-3"><div className="text-[10px] uppercase tracking-wider text-ink-muted">Signals</div><div className="font-mono text-xl text-ink-primary">{selectedCitySignal.total_signals}</div></div>
                        <div className="rounded-md border border-slate-border bg-slate-base/30 p-3"><div className="text-[10px] uppercase tracking-wider text-ink-muted">High risk</div><div className="font-mono text-xl text-ink-primary">{selectedCitySignal.high_risk_signals}</div></div>
                      </div>
                      <Badge variant="outline" style={{ backgroundColor: hexToRgba(categoryColor(selectedCitySignal.top_category), 0.12), borderColor: hexToRgba(categoryColor(selectedCitySignal.top_category), 0.3), color: categoryColor(selectedCitySignal.top_category) }}>{selectedCitySignal.top_category}</Badge>
                    </div>
                  ) : <div className="rounded-md border border-slate-border bg-slate-base/30 p-4 text-sm text-ink-secondary">Select a city marker.</div>}
                </div>
              </MapPanel>

              <MapPanel>
                <PanelHeader title="Funnel path insights" detail="Source city to destination city, grouped by category." action={<GitBranch className="size-4 text-signal-accent" />} />
                <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-3">
                  <div className="flex flex-col gap-2">
                    {filteredRoutes.map((route) => {
                      const active = route.id === selectedRouteId;
                      return (
                        <button key={route.id} onMouseEnter={() => setHoverRouteId(route.id)} onMouseLeave={() => setHoverRouteId(null)} onClick={() => setSelectedRouteId(route.id)} className={cn("rounded-md border bg-slate-base/30 p-3 text-left transition hover:border-signal-info/50 hover:bg-signal-info/10", active ? "border-signal-info/70 bg-signal-info/10" : "border-slate-border")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-semibold text-ink-primary"><span className="truncate">{route.from_city}</span><ArrowRight className="size-3 shrink-0 text-ink-muted" /><span className="truncate">{route.to_city}</span></div>
                              <div className="mt-1 truncate text-xs" style={{ color: categoryColor(route.category) }}>{route.category}</div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1"><Badge variant={severityVariant(route.severity)}>{route.severity}</Badge><Badge variant="outline">{(route.route_source ?? "co_mentioned").replace("_", " ")}</Badge></div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded border border-slate-border bg-slate-base/40 p-2"><div className="uppercase tracking-wider text-ink-muted">Signals</div><div className="mt-1 font-mono text-ink-primary">{route.signal_count}</div></div>
                            <div className="rounded border border-slate-border bg-slate-base/40 p-2"><div className="uppercase tracking-wider text-ink-muted">Max risk</div><div className="mt-1 font-mono text-ink-primary">{Math.round(route.max_risk)}</div></div>
                          </div>
                          <div className="mt-2 text-[11px] text-ink-muted">Last seen {route.last_seen ? formatDate(route.last_seen) : "unknown"}</div>
                        </button>
                      );
                    })}
                    {filteredRoutes.length === 0 ? <div className="rounded-md border border-slate-border bg-slate-base/30 p-3 text-sm text-ink-secondary">No route paths for the active filters.</div> : null}
                  </div>
                </div>
                {activeRoute ? <button onClick={() => openRoute(activeRoute)} className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-signal-accent transition hover:bg-signal-info/10"><Route className="size-4" /> Open route in Live Monitoring</button> : null}
              </MapPanel>

              <MapPanel>
                <PanelHeader title="Top locations" />
                <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-3">
                  <div className="flex flex-col gap-2">
                    {top.map((signal) => (
                      <button key={signal.city} onClick={() => setSelectedCity(signal.city)} className="flex items-center justify-between gap-3 rounded-md border border-slate-border bg-slate-base/30 p-3 text-left text-sm transition hover:border-signal-info/40 hover:bg-signal-info/10">
                        <span className="truncate text-ink-primary">{signal.city}</span>
                        <span className="shrink-0 font-mono text-xs text-ink-secondary">{signal.total_signals} signals</span>
                      </button>
                    ))}
                    {top.length === 0 ? <div className="rounded-md border border-slate-border bg-slate-base/30 p-3 text-sm text-ink-secondary">No locations yet.</div> : null}
                  </div>
                </div>
              </MapPanel>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
