import { useState, useEffect } from "react";
import { Search, ExternalLink, Loader2, Sparkles, ArrowRight, BadgeCheck, Mail, Check, Bookmark, Bell, X, ThumbsUp } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { fetchFreebies, fetchCategories, sendNotification, subscribeDigest, createAlert, listAlerts, deleteAlert } from "./lib/api";
import { cn } from "./lib/utils";
import LocationAutocomplete from "./components/LocationAutocomplete";

const CATEGORY_META = {
  samples:   { icon: "🎁", label: "Samples",   blurb: "Try before you buy" },
  trials:    { icon: "⏱️", label: "Trials",    blurb: "Free for a limited time" },
  giveaways: { icon: "🎉", label: "Giveaways", blurb: "Win big, pay nothing" },
  events:    { icon: "📍", label: "Events",    blurb: "Free fun near you" },
  birthday:  { icon: "🎂", label: "Birthday",  blurb: "Free stuff on your day" },
  digital:   { icon: "💾", label: "Digital",   blurb: "Free downloads" },
  food:      { icon: "🍕", label: "Food",      blurb: "Free bites" },
};

function FreebieCard({ freebie, index, selected, onToggle, saved, onSave, onOpen }) {
  const meta = CATEGORY_META[freebie.category] || { icon: "🆓", label: freebie.category };
  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200 border-2 cursor-pointer",
        selected ? "border-primary shadow-lg shadow-primary/20" : "hover:border-primary/50"
      )}
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
      onClick={() => onOpen(freebie)}
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
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onSave(freebie)}
              aria-label={saved ? "Unsave" : "Save"}
              className={cn(
                "h-6 w-6 rounded-md flex items-center justify-center transition-all",
                saved ? "text-primary" : "text-muted-foreground/50 hover:text-primary"
              )}
            >
              <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={() => onToggle(freebie)}
              aria-label={selected ? "Deselect" : "Select for email"}
              className={cn(
                "h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all",
                selected
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary"
              )}
            >
              {selected && <Check className="h-4 w-4" />}
            </button>
          </div>
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
          <a href={freebie.url} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center justify-center gap-1.5">
            <span>Claim it free</span>
            <ArrowRight className="h-4 w-4 shrink-0 group-hover/btn:translate-x-0.5 transition-transform" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

function DigestForm() {
  const [email, setEmail] = useState(() => localStorage.getItem("cheapsk8-email") || "");
  const [status, setStatus] = useState(""); // "", "sending", "done", "error"

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    try {
      await subscribeDigest(email);
      localStorage.setItem("cheapsk8-email", email);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <p className="text-sm text-primary flex items-center justify-center gap-1 py-2">
        <BadgeCheck className="h-4 w-4" /> You're in! See you every week. 🆓
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1"
        required
      />
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? <Loader2 className="animate-spin" /> : "Subscribe"}
      </Button>
    </form>
  );
}

function FreebieModal({ freebie, onClose, onClaim }) {
  if (!freebie) return null;
  const meta = CATEGORY_META[freebie.category] || { icon: "🆓", label: freebie.category };
  const [worked, setWorked] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{meta.icon}</span>
              <Badge variant="secondary">{meta.label}</Badge>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <CardTitle className="text-xl leading-snug pt-2">{freebie.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {freebie.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{freebie.description}</p>
          )}

          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" /> How to claim
            </p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Click "Claim it free" below to open the source page</li>
              <li>Follow the instructions on their site (usually a form or signup)</li>
              {freebie.how_to_claim && <li className="italic">{freebie.how_to_claim}</li>}
              <li>No purchase necessary — if they ask for payment, it's not a real freebie</li>
            </ol>
          </div>

          {freebie.url && (
            <p className="text-xs text-muted-foreground break-all">
              Source: <span className="underline">{(() => {
                try { return new URL(freebie.url).hostname; }
                catch { return freebie.url.slice(0, 40); }
              })()}</span>
            </p>
          )}

          <button
            onClick={() => setWorked(true)}
            disabled={worked}
            className={cn(
              "flex items-center gap-2 text-sm rounded-lg px-3 py-2 border transition-all w-full justify-center",
              worked
                ? "bg-primary/10 border-primary/40 text-primary"
                : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <ThumbsUp className="h-4 w-4" />
            {worked ? "Thanks for confirming! 🎉" : "This worked for me"}
          </button>
        </CardContent>
        <CardFooter>
          <Button className="w-full" size="lg" asChild>
            <a href={freebie.url} target="_blank" rel="noopener noreferrer" onClick={() => onClaim?.(freebie)}>
              Claim it free <ExternalLink className="ml-2" />
            </a>
          </Button>
        </CardFooter>
      </Card>
    </div>
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
  const [notifyStatus, setNotifyStatus] = useState("");
  const [showEmailBar, setShowEmailBar] = useState(false);
  const [tab, setTab] = useState("discover"); // "discover" | "saved"
  const [savedItems, setSavedItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cheapsk8-saved") || "[]"); }
    catch { return []; }
  });
  const [modalFreebie, setModalFreebie] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertKeyword, setAlertKeyword] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);

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

  const toggleSave = (freebie) => {
    setSavedItems((prev) => {
      const exists = prev.some((f) => f.url === freebie.url);
      const next = exists
        ? prev.filter((f) => f.url !== freebie.url)
        : [...prev, freebie];
      localStorage.setItem("cheapsk8-saved", JSON.stringify(next));
      return next;
    });
  };

  const isSaved = (url) => savedItems.some((f) => f.url === url);

  const loadAlerts = async () => {
    if (!email) return;
    try {
      const d = await listAlerts(email);
      setAlerts(d.alerts);
    } catch { /* ignore */ }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!email || !alertKeyword.trim()) return;
    localStorage.setItem("cheapsk8-email", email);
    try {
      await createAlert(email, alertKeyword.trim());
      setAlertKeyword("");
      loadAlerts();
    } catch { /* ignore */ }
  };

  const handleDeleteAlert = async (keyword) => {
    try {
      await deleteAlert(email, keyword);
      loadAlerts();
    } catch { /* ignore */ }
  };

  useEffect(() => { if (showAlerts) loadAlerts(); }, [showAlerts]);

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
              <LocationAutocomplete
                value={location}
                onChange={setLocation}
                className="sm:w-56 sm:border-l border-border"
              />
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
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant={tab === "discover" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("discover")}
          >
            <Sparkles className="mr-1 h-4 w-4" /> Discover
          </Button>
          <Button
            variant={tab === "saved" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("saved")}
          >
            <Bookmark className="mr-1 h-4 w-4" /> Saved ({savedItems.length})
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAlerts(!showAlerts)}
          >
            <Bell className="mr-1 h-4 w-4" /> Alerts
          </Button>
        </div>

        {/* Alerts panel */}
        {showAlerts && (
          <Card className="mb-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Keyword Alerts
              </CardTitle>
              <CardDescription>
                Get emailed when freebies matching your keywords appear.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={handleCreateAlert} className="flex gap-2">
                <Input
                  placeholder="Keyword (e.g. coffee, skincare)"
                  value={alertKeyword}
                  onChange={(e) => setAlertKeyword(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit">Add alert</Button>
              </form>
              {alerts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {alerts.map((a) => (
                    <Badge key={a.keyword} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                      🔔 {a.keyword}
                      <button
                        onClick={() => handleDeleteAlert(a.keyword)}
                        aria-label={`Remove ${a.keyword}`}
                        className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "saved" ? (
          savedItems.length === 0 ? (
            <div className="text-center py-20">
              <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-1">No saved freebies yet</p>
              <p className="text-sm text-muted-foreground">
                Click the bookmark icon on any card to save it here.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedItems.map((f, i) => (
                <FreebieCard
                  key={`saved-${f.url}-${i}`}
                  freebie={f}
                  index={i}
                  selected={selected.has(f.url)}
                  onToggle={toggleSelect}
                  saved={true}
                  onSave={toggleSave}
                  onOpen={setModalFreebie}
                />
              ))}
            </div>
          )
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm">Scouring the internet for freebies...</p>
          </div>
        ) : freebies.length === 0 && searched ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🕳️</div>
            <p className="text-lg font-medium mb-1">Nothing free found</p>
            <p className="text-sm text-muted-foreground">Try different keywords or another category.</p>
          </div>
        ) : (
          <div>
            {error && (
              <Card className="border-destructive mb-8">
                <CardContent className="pt-6 text-destructive text-sm">{error}</CardContent>
              </Card>
            )}
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
                  saved={isSaved(f.url)}
                  onSave={toggleSave}
                  onOpen={setModalFreebie}
                />
              ))}
            </div>
          </div>
        )}

        {/* Detail modal */}
        <FreebieModal
          freebie={modalFreebie}
          onClose={() => setModalFreebie(null)}
        />

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
        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* Weekly digest signup */}
          <div className="max-w-md mx-auto text-center mb-8">
            <h3 className="font-bold text-lg mb-1 flex items-center justify-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Weekly Freebie Digest
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get the best freebies in your inbox every week. No spam, unsubscribe anytime.
            </p>
            <DigestForm />
          </div>
          <div className="text-center border-t border-border pt-6">
            <p className="font-bold text-lg mb-1">Cheap<span className="text-primary">sk8</span> 🆓</p>
            <p className="text-sm text-muted-foreground">
              <a href="https://github.com/acbharath14/Cheapsk8" className="underline hover:text-foreground">Open source</a>
              {" · "}Powered by Tavily search + RSS feeds
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
