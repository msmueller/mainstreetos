/**
 * MainStreetOS · SignaturePad
 *
 * Drop-in replacement for the stub at the bottom of pages/sign-token-page.tsx.
 * Pure native canvas + SVG path generation — no external library.
 *
 * Behavior:
 *   - Captures mouse and touch events.
 *   - Each pen-down → pen-up = one <path> element.
 *   - "Clear"  : wipes the canvas, calls onChange(null), unlocks editing.
 *   - "Done"   : freezes the drawing, builds an SVG string, calls onChange(svg).
 *   - "Edit"   : (after Done) re-opens for further editing.
 *   - touch-action: none on the canvas — prevents page scroll while drawing.
 *
 * Output SVG is logical-pixel-coordinated and stroke-styled to render identically
 * inside the embedded PDF later.
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

type Point = { x: number; y: number };
type Stroke = Point[];

const STROKE_COLOR = '#1e3a5f';
const STROKE_WIDTH = 1.8;
const PAD_HEIGHT = 140;

export default function SignaturePad({
  onChange,
}: {
  onChange: (svg: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [committed, setCommitted] = useState(false);

  // ---------------------------------------------------------------------------
  // Resize canvas to its CSS box, scale for DPR so lines stay crisp.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sync = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = STROKE_WIDTH;
      // Re-render existing strokes after a resize
      redraw(ctx, strokesRef.current);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  // ---------------------------------------------------------------------------
  // Coordinate translation
  // ---------------------------------------------------------------------------
  const pointFrom = (e: PointerEvent | React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: round((e as PointerEvent).clientX - rect.left, 2),
      y: round((e as PointerEvent).clientY - rect.top, 2),
    };
  };

  // ---------------------------------------------------------------------------
  // Pointer event handlers
  // ---------------------------------------------------------------------------
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (committed) return;
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = pointFrom(e);
    currentStrokeRef.current = [p];
  }, [committed]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (committed) return;
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    const p = pointFrom(e);
    stroke.push(p);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || stroke.length < 2) return;
    const a = stroke[stroke.length - 2];
    const b = stroke[stroke.length - 1];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }, [committed]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (committed) return;
    const stroke = currentStrokeRef.current;
    if (stroke && stroke.length > 1) {
      strokesRef.current.push(stroke);
      setHasInk(true);
    }
    currentStrokeRef.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch {}
  }, [committed]);

  // ---------------------------------------------------------------------------
  // Buttons
  // ---------------------------------------------------------------------------
  const clear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    setHasInk(false);
    setCommitted(false);
    const ctx = canvasRef.current?.getContext('2d');
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  const done = () => {
    if (!hasInk) {
      onChange(null);
      return;
    }
    setCommitted(true);
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const svg = buildSvg(strokesRef.current, rect.width, rect.height);
    onChange(svg);
  };

  const edit = () => setCommitted(false);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="signature-pad" style={padStyle}>
      <canvas
        ref={canvasRef}
        style={{
          ...canvasStyle,
          cursor: committed ? 'default' : 'crosshair',
          opacity: committed ? 0.75 : 1,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div style={controlsStyle}>
        <button type="button" onClick={clear} style={btnSecondary}>
          Clear
        </button>
        {committed ? (
          <button type="button" onClick={edit} style={btnSecondary}>
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={done}
            disabled={!hasInk}
            style={hasInk ? btnPrimary : btnPrimaryDisabled}
          >
            Done
          </button>
        )}
        <span style={statusStyle}>
          {committed ? '✓ Signature captured' : hasInk ? 'Click Done when finished' : 'Sign with your finger or mouse'}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// SVG building
// =============================================================================

function buildSvg(strokes: Stroke[], w: number, h: number): string {
  if (strokes.length === 0) return '';
  const paths = strokes
    .filter((s) => s.length > 1)
    .map((s) => {
      const d = strokeToPathD(s);
      return `<path d="${d}" fill="none" stroke="${STROKE_COLOR}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');

  return [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` viewBox="0 0 ${round(w, 0)} ${round(h, 0)}"`,
    ` preserveAspectRatio="xMidYMid meet">`,
    paths,
    '</svg>',
  ].join('');
}

function strokeToPathD(stroke: Stroke): string {
  // Move to first point, then a series of L (line-to) commands
  const head = stroke[0];
  let d = `M${head.x} ${head.y}`;
  for (let i = 1; i < stroke.length; i++) {
    d += ` L${stroke[i].x} ${stroke[i].y}`;
  }
  return d;
}

function redraw(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
    ctx.stroke();
  }
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// =============================================================================
// Styles — inline for component portability; matches the signing page tokens.
// =============================================================================

const padStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
};

const canvasStyle: React.CSSProperties = {
  width: '100%',
  height: PAD_HEIGHT,
  border: '1.5px dashed #d8d2c4',
  background: '#fdfcf8',
  touchAction: 'none', // prevent page scroll on touch devices while drawing
  display: 'block',
};

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 13,
  letterSpacing: '0.02em',
  border: 0,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: '#f7f4ec',
  color: '#2c3e50',
  border: '1px solid #d8d2c4',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: STROKE_COLOR,
  color: '#fdfcf8',
};

const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary,
  opacity: 0.45,
  cursor: 'not-allowed',
};

const statusStyle: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 12,
  color: '#2c3e50',
  marginLeft: 'auto',
};
