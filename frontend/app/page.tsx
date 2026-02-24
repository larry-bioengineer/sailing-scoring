import Link from "next/link";

export default function Home() {
  return (
    <div className="py-8 px-6 sm:px-8 lg:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Result Generator
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Use the sidebar to navigate to Events, Entries, Record, or Results.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { name: "Events", href: "/events", desc: "Manage and view events" },
          { name: "Entries", href: "/entries", desc: "View and manage entries" },
          { name: "Record", href: "/record", desc: "Record scores and data" },
          { name: "Results", href: "/results", desc: "View and export results" },
        ].map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
              {item.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {item.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
