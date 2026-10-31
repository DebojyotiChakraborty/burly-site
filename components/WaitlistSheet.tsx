"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";

/** The waitlist side sheet. Any [data-waitlist] button on the page opens it. */
export default function WaitlistSheet() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [source, setSource] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const email = useRef<HTMLInputElement>(null);
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

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = (email.current?.value || "").trim();
    if (!value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      email.current?.focus();
      setInvalid(true);
      return;
    }
    setInvalid(false);
    // No backend yet: the sheet only shows the confirmation state. Wire the
    // form to a list provider (POST this value) before launch.
    setDone(true);
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
              />
            </div>
            <button className="btn primary wl-submit" type="submit">
              Join the waitlist
              <svg aria-hidden="true">
                <use href="#i-arrow" />
              </svg>
            </button>
          </form>
          <p className="wl-fine">One email when the beta opens. No newsletter, no sharing.</p>
          <div className="wl-done">
            <b>You&apos;re on the list.</b>
            <p>The link lands in your inbox the day the beta opens.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
