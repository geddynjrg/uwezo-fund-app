import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMapEmbedUrl,
  buildMapLink,
  defaultMapView,
  geocodeArea,
  mapViewFromSuggestion,
  probeGeocodeReachable,
  searchLandmarkSuggestions,
  shortLandmarkLabel,
  ZOOM_DELTAS,
  type GeocodeSuggestion,
  type LandmarkLocationContext,
  type MapView,
} from '../lib/geocode';

type LandmarkMapFieldProps = {
  value: string;
  readOnly?: boolean;
  locationContext: LandmarkLocationContext;
  onChange: (value: string) => void;
};

export function LandmarkMapField({
  value,
  readOnly,
  locationContext,
  onChange,
}: LandmarkMapFieldProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [selected, setSelected] = useState<GeocodeSuggestion | null>(null);
  const [preview, setPreview] = useState<GeocodeSuggestion | null>(null);
  const [areaView, setAreaView] = useState<MapView | null>(null);
  const [loading, setLoading] = useState(false);
  const [areaLoading, setAreaLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [geocodeReachable, setGeocodeReachable] = useState<boolean | null>(null);
  const debounceRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const areaAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void probeGeocodeReachable().then((ok) => {
      if (!cancelled) setGeocodeReachable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    areaAbortRef.current?.abort();
    if (!locationContext.county?.trim() || geocodeReachable === false) {
      setAreaView(null);
      return;
    }
    const controller = new AbortController();
    areaAbortRef.current = controller;
    const delta = locationContext.ward?.trim()
      ? ZOOM_DELTAS.ward
      : locationContext.constituency?.trim()
        ? ZOOM_DELTAS.constituency
        : ZOOM_DELTAS.county;
    setAreaLoading(true);
    void geocodeArea(locationContext, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (geocodeReachable == null && result.reachable) setGeocodeReachable(true);
        if (!result.reachable) setGeocodeReachable(false);
        const match = result.results[0];
        setAreaView(match ? mapViewFromSuggestion(match, delta) : null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAreaLoading(false);
      });
    return () => controller.abort();
  }, [
    locationContext.county,
    locationContext.constituency,
    locationContext.ward,
    geocodeReachable,
    locationContext,
  ]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      searchAbortRef.current?.abort();
      areaAbortRef.current?.abort();
    };
  }, []);

  function runSearch(query: string) {
    if (readOnly || geocodeReachable === false) return;
    searchAbortRef.current?.abort();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setPreview(null);
      setSearchError(null);
      setListOpen(false);
      return;
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoading(true);
    void searchLandmarkSuggestions(trimmed, locationContext, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.reachable) {
          setGeocodeReachable(false);
          setSuggestions([]);
          setSearchError(result.error);
          setListOpen(false);
          return;
        }
        setGeocodeReachable(true);
        setSuggestions(result.results);
        setPreview(result.results[0] ?? null);
        setSearchError(result.degraded ? result.error : null);
        setListOpen(result.results.length > 0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }

  function onInputChange(next: string) {
    onChange(next);
    setSelected(null);
    setPreview(null);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(next), 280);
  }

  function pickSuggestion(suggestion: GeocodeSuggestion) {
    const label = shortLandmarkLabel(suggestion.label);
    setSelected(suggestion);
    setPreview(suggestion);
    onChange(label);
    setSuggestions([]);
    setListOpen(false);
    setSearchError(null);
  }

  const mapView = useMemo<MapView>(() => {
    if (selected) {
      return mapViewFromSuggestion(selected, ZOOM_DELTAS.landmark, { preferDelta: true });
    }
    if (preview && value.trim().length >= 2) {
      return mapViewFromSuggestion(preview, ZOOM_DELTAS.landmark, { preferDelta: true });
    }
    if (areaView) return areaView;
    return defaultMapView();
  }, [areaView, preview, selected, value]);

  const showMap = geocodeReachable !== false && (Boolean(selected) || Boolean(preview) || Boolean(areaView));
  const statusLabel = selected
    ? `Selected: ${shortLandmarkLabel(selected.label)}`
    : preview && value.trim().length >= 2
      ? `Showing: ${shortLandmarkLabel(preview.label)}`
      : areaView?.label
        ? `Area: ${areaView.label}`
        : 'Search for a landmark to pin its location on the map.';

  return (
    <div className="landmark-field">
      <label>
        Nearest landmark
        <input
          value={value}
          readOnly={readOnly}
          placeholder="e.g. school, mosque, church"
          autoComplete="off"
          role="combobox"
          aria-expanded={listOpen}
          aria-autocomplete="list"
          onChange={(event) => onInputChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setListOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setListOpen(false), 150);
          }}
        />
      </label>
      {loading || areaLoading ? <p className="home-chat-note">Looking up places…</p> : null}
      {searchError ? <p className="landmark-field__hint landmark-field__hint--soft">{searchError}</p> : null}
      {geocodeReachable === false ? (
        <p className="landmark-field__hint landmark-field__hint--soft">
          Location search is offline. Type the nearest landmark and continue — the form is not blocked.
        </p>
      ) : null}
      {listOpen && suggestions.length > 0 ? (
        <ul className="landmark-field__list" role="listbox">
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                className="landmark-field__option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickSuggestion(suggestion)}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showMap ? (
        <div className="landmark-field__map">
          <iframe title="Selected landmark map" src={buildMapEmbedUrl(mapView)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="landmark-field__map-meta">
            <p>{statusLabel}</p>
            <a href={buildMapLink(mapView)} target="_blank" rel="noreferrer">
              Open in OpenStreetMap
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
