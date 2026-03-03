"use client";

export function CS2AmbientBackground() {
  return (
    <div className="cs2-ambient" aria-hidden>
      <div className="cs2-ambient__base" />
      <div className="cs2-ambient__side cs2-ambient__side--left" />
      <div className="cs2-ambient__side cs2-ambient__side--right" />
      <div className="cs2-ambient__sideGlow cs2-ambient__sideGlow--left" />
      <div className="cs2-ambient__sideGlow cs2-ambient__sideGlow--right" />
      <div className="cs2-ambient__beam cs2-ambient__beam--hot" />
      <div className="cs2-ambient__beam cs2-ambient__beam--cold" />
      <div className="cs2-ambient__smoke cs2-ambient__smoke--left" />
      <div className="cs2-ambient__smoke cs2-ambient__smoke--right" />
      <div className="cs2-ambient__structure cs2-ambient__structure--back" />
      <div className="cs2-ambient__structure cs2-ambient__structure--mid" />
      <div className="cs2-ambient__catwalk" />
      <div className="cs2-ambient__lane" />
      <div className="cs2-ambient__tracer cs2-ambient__tracer--1" />
      <div className="cs2-ambient__tracer cs2-ambient__tracer--2" />
      <div className="cs2-ambient__tracer cs2-ambient__tracer--3" />
      <div className="cs2-ambient__grid" />
      <div className="cs2-ambient__dust" />
      <div className="cs2-ambient__grain" />
      <div className="cs2-ambient__vignette" />
    </div>
  );
}
