import { Link } from "react-router-dom";

export default function SiteHeader({ showBackLink = false }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between">
      <Link className="brand-mark" to="/" aria-label="Queuebox home">
        <span className="brand-icon" aria-hidden="true">q</span>
        <span>queuebox</span>
      </Link>
      {showBackLink ? (
        <Link className="back-link" to="/">← Back home</Link>
      ) : (
        <span className="top-note"><span className="live-dot" /> your people, your playlist</span>
      )}
    </header>
  );
}
