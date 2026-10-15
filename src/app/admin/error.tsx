"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="panel admin-error" role="alert">
      <p className="eyebrow">Unable to load</p>
      <h1>This view is temporarily unavailable</h1>
      <p className="muted">
        We could not retrieve the latest store information. Check your
        connection and try again. If this continues, verify your account access
        and database availability.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
