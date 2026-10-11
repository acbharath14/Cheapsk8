import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export default function LocationAutocomplete({ value, onChange, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  // Close dropdown on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = async (q) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
        { headers: { "Accept": "application/json" } }
      );
      const data = await res.json();
      const formatted = data.map((d) => {
        const a = d.address || {};
        const city = a.city || a.town || a.village || a.county || "";
        const state = a.state || "";
        const country = a.country_code?.toUpperCase() || "";
        const label = [city, state].filter(Boolean).join(", ") || d.display_name.split(",").slice(0, 2).join(",");
        return { label: label.trim(), detail: country, lat: d.lat, lon: d.lon };
      });
      setSuggestions(formatted);
      setOpen(formatted.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    const v = e.target.value;
    onChange(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 350);
  };

  const pick = (s) => {
    onChange(s.label);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        placeholder="Location"
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="w-full h-12 bg-transparent pl-11 pr-10 text-[15px] placeholder:text-muted-foreground focus:outline-none"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border bg-popover shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              type="button"
              onClick={() => pick(s)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
            >
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.label}</p>
                {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
