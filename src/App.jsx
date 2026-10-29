import { createContext, useContext, useEffect, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_KEY = import.meta.env.VITE_GNEWS_KEY; // local development only

// Local: call GNews directly (the free plan allows localhost).
// Deployed: call our own /api/news (the free plan blocks deployed sites via CORS).
function newsUrl(country, category) {
  if (IS_DEV) {
    return `https://gnews.io/api/v4/top-headlines?category=${category}&country=${country}&lang=en&max=10&apikey=${API_KEY}`;
  }
  return `/api/news?country=${country}&category=${category}`;
}

const PLACEHOLDER_IMAGE =
  "https://placehold.co/600x300/e0f2fe/0f766e?text=WorldNews";

/* ---------------- GLOBAL STATE (Context) ---------------- */
const NewsContext = createContext();
const useNews = () => useContext(NewsContext);

function NewsProvider({ children }) {
  const [page, setPage] = useState("home");
  const [country, setCountry] = useState("pk");
  const [category, setCategory] = useState("general");
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("saved")) || [];
    } catch {
      return [];
    }
  });

  // Keep saved articles after a page refresh
  useEffect(() => {
    localStorage.setItem("saved", JSON.stringify(saved));
  }, [saved]);

  // Fetch news when country or category changes (no API call if cached)
  useEffect(() => {
    const id = `${country}-${category}`;

    // Already cached: nothing to fetch, and make sure no stale loader is left on
    if (cache[id]) {
      setError(null);
      setLoading(false);
      return;
    }

    // The key is only needed locally; on Vercel the server holds it
    if (IS_DEV && !API_KEY) {
      setError("API key not found. Check your .env file and restart the dev server.");
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    setError(null);

    fetch(newsUrl(country, category))
      .then((res) => {
        if (!res.ok) throw new Error("Could not load news. Please try again.");
        return res.json();
      })
      .then((data) => {
        if (!ignore) setCache((c) => ({ ...c, [id]: data.articles || [] }));
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, category, retry]);

  const toggleSave = (article) =>
    setSaved((s) =>
      s.some((a) => a.url === article.url)
        ? s.filter((a) => a.url !== article.url)
        : [...s, article]
    );

  const value = {
    page,
    setPage,
    country,
    setCountry,
    category,
    setCategory,
    articles: cache[`${country}-${category}`] || [],
    loading,
    error,
    retry: () => setRetry((r) => r + 1),
    saved,
    toggleSave,
  };

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

/* ---------------- UI COMPONENTS ---------------- */
function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 text-4xl">
        📰
      </div>
      <h2 className="mt-5 text-xl font-bold text-zinc-900">{title}</h2>
      <p className="mt-1 text-zinc-600">{text}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-5 rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="h-40 bg-zinc-200" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/4 rounded bg-zinc-200" />
        <div className="h-4 w-full rounded bg-zinc-200" />
        <div className="h-4 w-2/3 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

function NewsCard({ article }) {
  const { saved, toggleSave } = useNews();
  const isSaved = saved.some((a) => a.url === article.url);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {article.image ? (
        <img
          src={article.image}
          alt={article.title || "News article"}
          className="h-44 w-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      ) : (
        <img
          src={PLACEHOLDER_IMAGE}
          alt="WorldNews placeholder"
          className="h-44 w-full object-cover"
        />
      )}

      <div className="p-4">
        <p className="text-xs text-zinc-500">{article.source?.name}</p>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 line-clamp-2 font-semibold text-zinc-900 hover:text-indigo-600"
        >
          {article.title}
        </a>
        <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
          {article.description}
        </p>
        <button
          onClick={() => toggleSave(article)}
          className={`mt-3 rounded-lg px-3 py-1.5 text-sm font-medium ${
            isSaved
              ? "bg-indigo-600 text-white"
              : "border border-zinc-200 text-zinc-700"
          }`}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

const COUNTRIES = [
  { code: "pk", name: "Pakistan" },
  { code: "us", name: "USA" },
  { code: "in", name: "India" },
  { code: "gb", name: "UK" },
  { code: "ae", name: "UAE" },
];

const CATEGORIES = [
  "general",
  "business",
  "technology",
  "sports",
  "health",
  "science",
  "entertainment",
];

function CountryTabs() {
  const { country, setCountry } = useNews();
  return (
    <div className="flex w-full gap-2 overflow-x-auto px-4 py-3">
      {COUNTRIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCountry(c.code)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
            country === c.code
              ? "bg-indigo-600 text-white"
              : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function CategoryChips() {
  const { category, setCategory } = useNews();
  return (
    <div className="flex w-full gap-2 overflow-x-auto px-4 pb-3">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => setCategory(c)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm capitalize ${
            category === c
              ? "bg-indigo-100 font-semibold text-indigo-700"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function Navbar() {
  const { setPage, saved } = useNews();
  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <button
        onClick={() => setPage("home")}
        className="text-xl font-bold text-indigo-600"
      >
        WorldNews
      </button>
      <button
        onClick={() => setPage("saved")}
        className="font-medium text-zinc-700"
      >
        Saved ({saved.length})
      </button>
    </nav>
  );
}

/* ---------------- PAGES ---------------- */
function Home() {
  const { articles, loading, error, retry } = useNews();

  return (
    <>
      <CountryTabs />
      <CategoryChips />

      {loading ? (
        <div
          className="grid min-h-[60vh] content-start gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading news"
          aria-busy="true"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Something went wrong"
          text={error}
          actionLabel="Try Again"
          onAction={retry}
        />
      ) : articles.length === 0 ? (
        <EmptyState
          title="No News Found"
          text="There are currently no articles available for this country and category."
        />
      ) : (
        <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <NewsCard key={a.url} article={a} />
          ))}
        </div>
      )}
    </>
  );
}

function Saved() {
  const { saved, setPage } = useNews();

  if (!saved.length)
    return (
      <EmptyState
        title="No saved articles"
        text="Tap Save on any news article and it will show up here."
        actionLabel="Browse news"
        onAction={() => setPage("home")}
      />
    );

  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
      {saved.map((a) => (
        <NewsCard key={a.url} article={a} />
      ))}
    </div>
  );
}

function Content() {
  const { page } = useNews();
  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar />
      {page === "home" ? <Home /> : <Saved />}
    </div>
  );
}

/* ---------------- ROOT ---------------- */
export default function App() {
  return (
    <NewsProvider>
      <Content />
    </NewsProvider>
  );
}