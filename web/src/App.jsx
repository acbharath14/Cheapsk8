import { useState, useEffect } from "react";
import { Search, MapPin, ExternalLink, Gift, Loader2, Sparkles, ArrowRight, BadgeCheck, Mail, Check } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { fetchFreebies, fetchCategories, sendNotification } from "./lib/api";
import { cn } from "./lib/utils";

const CATEGORY_META = {
  samples:   { icon: "🎁", label: "Samples",   blurb: "Try before you buy" },
  trials:    { icon: "⏱️", label: "Trials",    blurb: "Free for a limited time" },
  giveaways: { icon: "🎉", label: "Giveaways", blurb: "Win big, pay nothing" },
  events:    { icon: "📍", label: "Events",    blurb: "Free fun near you" },
  birthday:  { icon: "🎂", label: "Birthday",  blurb: "Free stuff on your day" },
  digital:   { icon: "💾", label: "Digital",   blurb: "Free downloads" },
  food:      { icon: "🍕", label: "Food",      blurb: "Free bites" },
};

function FreebieCard({ freebie, index, selected, onToggle }) {
  const meta = CATEGORY_META[freebie.category] || { icon: "🆓", label: freebie.category };
  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200 border-2",
        selected ? "border-primary shadow-lg shadow-primary/20" : "hover:border-primary/50"
      )}
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{meta.icon}</span>
            <Badge variant="secondary" className="text-xs">
              {meta.label}
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => onToggle(freebie)}
            aria-label={selected ? "Deselect" : "Select for email"}
            className={cn(
              "h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
              selected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/40 hover:border-primary"
            )}
          >
            {selected && <Check className="h-4 w-4" />}
          </button>
        </div>
        <CardTitle className="text-[15px] leading-snug pt-1 group-hover:text-primary transition-colors">
          {freebie.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        <CardDescription className="line-clamp-3 text-[13px]">
          {freebie.description || "No description available — click through to see the details."}
        </CardDescription>
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="default" size="sm" className="w-full group/btn" asChild>
          <a href={freebie.url} target="_blank" rel="noopener noreferrer">
            Claim it free
            <ArrowRight className="ml-1 group-hover/btn:translate-x-0.5 transition-transform" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function App() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("samples");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [freebies, setFreebies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [email, setEmail] = useState(() => localStorage.getItem("cheapsk8-email") || "");
  const [notifyStatus, setNotifyStatus] = useState(""); // "", "sending", "sent", "error"
  const [showEmailBar, setShowEmailBar] = useState(false);

  // Dark mode by default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    fetchCategories().then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const search = async (e, categoryOverride) => {
    e?.preventDefault();
    const activeCategory = categoryOverride || category;
    setLoading(true);
    setError("");
    try {
      const data = await fetchFreebies({ category: activeCategory, query, location });
      setFreebies(data.freebies);
      setSearched(true);
    } catch (err) {
      setError("Couldn't fetch freebies. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (id) => {
    setCategory(id);
    search(null, id);
  };

  const toggleSelect = (freebie) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(freebie.url)) next.delete(freebie.url);
      else next.add(freebie.url);
      return next;
    });
  };

  const handleNotify = async () => {
    if (!email || selected.size === 0) return;
    setNotifyStatus("sending");
    localStorage.setItem("cheapsk8-email", email);
    const picked = freebies.filter((f) => selected.has(f.url));
    try {
      await sendNotification(email, picked);
      setNotifyStatus("sent");
      setSelected(new Set());
      setTimeout(() => { setNotifyStatus(""); setShowEmailBar(false); }, 4000);
    } catch (err) {
      setNotifyStatus("error");
    }
  };

  useEffect(() => { search(); }, []);

  const activeMeta = CATEGORY_META[category] || {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-10 text-center">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <Sparkles className="mr-1 h-3 w-3" /> 100% free, zero catch
          </Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-3">
            Cheap<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">sk8</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Stop paying for stuff you can get for free. We hunt down samples,
            trials, giveaways & events across the internet.
          </p>

          {/* Search */}
          <form onSubmit={search} className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-2 p-2 rounded-2xl bg-card border-2 border-border shadow-xl focus-within:border-primary/60 transition-colors">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="What do you want for free?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-12 bg-transparent pl-11 pr-4 text-[15px] placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="relative sm:w-44 sm:border-l border-border">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-12 bg-transparent pl-11 pr-4 text-[15px] placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <Button type="submit" disabled={loading} size="lg" className="h-12 px-8 text-[15px] font-semibold shrink-0">
                {loading ? <Loader2 className="animate-spin" /> : "Hunt 🆓"}
              </Button>
            </div>
          </form>

          {/* Category pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {categories.map((c) => {
              const m = CATEGORY_META[c.id] || { icon: "🆓", label: c.label };
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCategoryClick(c.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-105"
                      : "bg-card border-border hover:border-primary/50 hover:scale-102 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              );
            })}
          </div>
          {activeMeta.blurb && (
            <p className="text-sm text-muted-foreground mt-3 italic">{activeMeta.blurb}</p>
          )}
        </div>
      </div>

      {/* Results */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        {error && (
          <Card className="border-destructive mb-8">
            <CardContent className="pt-6 text-destructive text-sm">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <p className="mt-4 text-sm">Scouring the internet for freebies...</p>
          </div>
        ) : searched && freebies.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🕳️</div>
            <p className="text-lg font-medium mb-1">Nothing free found</p>
            <p className="text-sm text-muted-foreground">Try different keywords or another category.</p>
          </div>
        ) : (
          <>
            {searched && freebies.length > 0 && (
              <div className="flex items-center gap-2 mb-5">
                <BadgeCheck className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Found <span className="font-semibold text-foreground">{freebies.length}</span> freebies
                  {query && <> for <span className="font-semibold text-foreground">"{query}"</span></>}
                </p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {freebies.map((f, i) => (
                <FreebieCard
                  key={`${f.url}-${i}`}
                  freebie={f}
                  index={i}
                  selected={selected.has(f.url)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>
          </>
        )}

        {/* Floating email bar */}
        {selected.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl">
            <Card className="border-primary/50 shadow-2xl">
              <CardContent className="p-4">
                {!showEmailBar ? (
                  <Button onClick={() => setShowEmailBar(true)} className="w-full" size="lg">
                    <Mail className="mr-2" />
                    Email me these {selected.size} freebie{selected.size > 1 ? "s" : ""}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleNotify}
                        disabled={!email || notifyStatus === "sending"}
                      >
                        {notifyStatus === "sending" ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          "Send"
                        )}
                      </Button>
                    </div>
                    {notifyStatus === "sent" && (
                      <p className="text-sm text-primary flex items-center gap-1">
                        <BadgeCheck className="h-4 w-4" /> Sent! Check your inbox.
                      </p>
                    )}
                    {notifyStatus === "error" && (
                      <p className="text-sm text-destructive">
                        Couldn't send. The server may not have email configured yet.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="font-bold text-lg mb-1">Cheap<span className="text-primary">sk8</span> 🆓</p>
          <p className="text-sm text-muted-foreground">
            <a href="https://github.com/acbharath14/Cheapsk8" className="underline hover:text-foreground">Open source</a>
            {" · "}Powered by Tavily search
          </p>
        </div>
      </footer>
    </div>
  );
}
