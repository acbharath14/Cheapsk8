import { useState, useEffect } from "react";
import { Search, MapPin, ExternalLink, Gift, Loader2, PiggyBank } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { fetchFreebies, fetchCategories } from "./lib/api";

const CATEGORY_ICONS = {
  samples: "🎁", trials: "⏱️", giveaways: "🎉", events: "📍",
  birthday: "🎂", digital: "💾", food: "🍕",
};

function FreebieCard({ freebie }) {
  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary" className="shrink-0">
            {CATEGORY_ICONS[freebie.category] || "🆓"} {freebie.category}
          </Badge>
          {freebie.status !== "verified" && (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">
              unverified
            </Badge>
          )}
        </div>
        <CardTitle className="text-base leading-snug pt-2">{freebie.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="line-clamp-3">
          {freebie.description || "No description available."}
        </CardDescription>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={freebie.url} target="_blank" rel="noopener noreferrer">
            Claim it <ExternalLink className="ml-1" />
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

  useEffect(() => {
    fetchCategories().then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const search = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await fetchFreebies({ category, query, location });
      setFreebies(data.freebies);
      setSearched(true);
    } catch (err) {
      setError("Couldn't fetch freebies. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground rounded-lg p-2">
            <PiggyBank className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cheapsk8</h1>
            <p className="text-sm text-muted-foreground">
              Find free stuff online — samples, trials, giveaways & more
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardContent className="pt-6">
            <form onSubmit={search} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="What are you looking for? (e.g. coffee, skincare)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative md:w-48">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Location (optional)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={loading} className="md:w-32">
                {loading ? <Loader2 className="animate-spin" /> : <><Search className="mr-1" /> Hunt</>}
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 mt-4">
              {categories.map((c) => (
                <Button
                  key={c.id}
                  variant={category === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(c.id)}
                  type="button"
                >
                  {CATEGORY_ICONS[c.id]} {c.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive mb-8">
            <CardContent className="pt-6 text-destructive text-sm">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="animate-spin mr-2" /> Hunting for freebies...
          </div>
        ) : searched && freebies.length === 0 ? (
          <div className="text-center py-16">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No freebies found. Try different keywords.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {freebies.map((f, i) => (
              <FreebieCard key={`${f.url}-${i}`} freebie={f} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Cheapsk8 🆓 — powered by <a href="https://github.com/acbharath14/Cheapsk8" className="underline">open source</a>
        </div>
      </footer>
    </div>
  );
}
