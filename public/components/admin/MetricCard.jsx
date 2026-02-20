import React from "react";

function useCountUp(value, duration = 500) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = Number(value) || 0;

    if (from === to) return;

    let raf = 0;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      // easing suave
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

export const MetricCard = ({ variant, label, value, icon }) => {
  const n = useCountUp(value, 550);

  return (
    <article className={`metric metric--${variant}`} role="group" aria-label={label}>
      <div className="metric__top">
        <span className="metric__icon">{icon}</span>
        <span className="metric__label">{label}</span>
      </div>

      <div className="metric__value" aria-live="polite">
        {n}
      </div>

      <div className="metric__glow" aria-hidden="true" />
    </article>
  );
};