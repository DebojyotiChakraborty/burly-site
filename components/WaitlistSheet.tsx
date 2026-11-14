"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";

/** The waitlist side sheet. Any [data-waitlist] button on the page opens it. */
export default function WaitlistSheet() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const trap = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const openRef = useRef(false);

  const close = () => {
    openRef.current = false;
    setOpen(false);
    document.body.style.overflow = "";
    (opener.current as HTMLElement | null)?.focus?.();
  };

  useEffect(() => {
    let focusTimer = 0;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest?.<HTMLElement>("[data-waitlist]");
      if (!btn) return;
      opener.current = document.activeElement;
      openRef.current = true;
      setSource(btn.dataset.waitlist || "");
      setOpen(true);
      document.body.style.overflow = "hidden";
      focusTimer = window.setTimeout(() => email.current?.focus(), 50);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openRef.current) close();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!panel.current?.contains(e.target as Node)) close();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const value = (email.current?.value || "").trim();
    if (!value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      email.current?.focus();
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value, hp: trap.current?.value || "" }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setDone(true);
      } else {
        setError(data?.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="wl-overlay"
      id="waitlist"
      hidden={!open}
      data-done={done ? "true" : "false"}
      data-source={source}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wl-title"
      onPointerDown={onPointerDown}
    >
      <div className="wl-dialog">
        <div className="wl-panel" ref={panel}>
          <div className="wl-head">
            <span className="upper">Waitlist</span>
            <button className="icon-btn wl-x" type="button" aria-label="Close" onClick={close}>
              <svg aria-hidden="true">
                <use href="#i-close" />
              </svg>
            </button>
          </div>
          <h2 id="wl-title">First in line.</h2>
          <p className="wl-lede">Leave an email and the TestFlight link reaches you before the store listing goes live.</p>
          <form className="wl-form" noValidate onSubmit={onSubmit}>
            <div className="wl-field">
              <label htmlFor="wl-email">Email</label>
              <input
                ref={email}
                id="wl-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                aria-invalid={invalid ? "true" : undefined}
                aria-describedby={error ? "wl-error" : undefined}
              />
            </div>
            {/* Honeypot: hidden from people, filled in by bots. The server drops any submission that sets it.
                The name and label are meaningless on purpose so browser autofill never fills it for a real visitor. */}
            <div className="wl-trap" aria-hidden="true">
              <label htmlFor="wl-hp">Leave this empty</label>
              <input ref={trap} id="wl-hp" type="text" name="wl-hp" tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" />
            </div>
            {error && (
              <p className="wl-error" id="wl-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary wl-submit" type="submit" disabled={pending} aria-busy={pending ? "true" : undefined}>
              {pending ? "Joining" : "Join the waitlist"}
              <svg aria-hidden="true">
                <use href="#i-arrow" />
              </svg>
            </button>
          </form>
          <p className="wl-fine">A confirmation now, then one email when the beta opens. No newsletter, no sharing.</p>
          <div className="wl-done">
            <b>You&apos;re on the list.</b>
            <p>The link lands in your inbox the day the beta opens.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
