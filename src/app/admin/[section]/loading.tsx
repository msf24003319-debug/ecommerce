export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading management view">
      <p role="status" className="muted">
        Loading your workspace…
      </p>
      <div className="skeleton admin-heading-skeleton" />
      <div className="metric-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton admin-metric-skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton" />
    </div>
  );
}
