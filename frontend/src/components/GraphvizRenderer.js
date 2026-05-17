import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { instance } from '@viz-js/viz';
import svgPanZoom from 'svg-pan-zoom';

let vizPromise = null;
const getViz = () => {
  if (!vizPromise) vizPromise = instance();
  return vizPromise;
};

/**
 * Renderiza un string DOT como SVG usando @viz-js/viz, con zoom/pan opcional
 * e inyección de listeners en los nodos resultantes.
 *
 * Props:
 *   dot          - string DOT (obligatorio para renderizar)
 *   panZoom      - bool, default true
 *   onNodeClick  - (nodeId, event) => void; nodeId = atributo id del <g class="node">
 *   className    - clases adicionales del contenedor
 *   minHeight    - alto mínimo (px) del contenedor, default 360
 *
 * Métodos expuestos por ref:
 *   zoomIn(), zoomOut(), reset()
 *   getSvgString() → string del SVG actualmente renderizado (para export)
 */
const GraphvizRenderer = forwardRef(function GraphvizRenderer(
  { dot, panZoom = true, onNodeClick, className = '', minHeight = 360 },
  ref
) {
  const containerRef = useRef(null);
  const panZoomRef = useRef(null);
  const observerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const safe = (fn) => {
    try { fn(); } catch (_) { /* ignore — pan-zoom puede fallar si la matriz es singular */ }
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => safe(() => panZoomRef.current?.zoomIn()),
    zoomOut: () => safe(() => panZoomRef.current?.zoomOut()),
    reset: () => safe(() => {
      panZoomRef.current?.resetZoom();
      panZoomRef.current?.center();
    }),
    getSvgString: () => containerRef.current?.querySelector('svg')?.outerHTML || '',
  }));

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    if (!dot) {
      el.innerHTML = '';
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    getViz()
      .then((viz) => {
        if (cancelled) return;
        let svgEl;
        try {
          svgEl = viz.renderSVGElement(dot);
        } catch (e) {
          setError(e.message || 'Error de renderizado Graphviz');
          setLoading(false);
          return;
        }

        // Limpiar pan-zoom y observer previos
        if (panZoomRef.current) {
          try { panZoomRef.current.destroy(); } catch (_) {}
          panZoomRef.current = null;
        }
        if (observerRef.current) {
          try { observerRef.current.disconnect(); } catch (_) {}
          observerRef.current = null;
        }

        el.innerHTML = '';
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.minHeight = `${minHeight}px`;
        el.appendChild(svgEl);

        const tryInitPanZoom = () => {
          if (panZoomRef.current) return true;
          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) return false;
          try {
            panZoomRef.current = svgPanZoom(svgEl, {
              zoomScaleSensitivity: 0.3,
              minZoom: 0.2,
              maxZoom: 8,
              controlIconsEnabled: false,
              fit: true,
              center: true,
            });
            return true;
          } catch (e) {
            console.warn('svg-pan-zoom init failed:', e);
            return false;
          }
        };

        if (panZoom) {
          const initialized = tryInitPanZoom();

          // Observamos siempre el contenedor: si inicializamos tarde (dentro de un
          // accordion colapsado) lo hacemos al primer cambio de tamaño; si ya
          // está inicializado, re-fit en resize de ventana / expand de accordion.
          if (typeof ResizeObserver !== 'undefined') {
            observerRef.current = new ResizeObserver(() => {
              if (!panZoomRef.current) {
                tryInitPanZoom();
              } else {
                safe(() => {
                  panZoomRef.current.resize();
                  panZoomRef.current.fit();
                  panZoomRef.current.center();
                });
              }
            });
            observerRef.current.observe(el);
          }

          // Si no se inicializó por dimensiones cero, esperamos al ResizeObserver.
          if (!initialized) {
            // no-op: el observer dispara tryInitPanZoom cuando el contenedor crezca
          }
        }

        if (onNodeClick) {
          svgEl.querySelectorAll('g.node').forEach((g) => {
            g.style.cursor = 'pointer';
            g.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const id = g.getAttribute('id');
              onNodeClick(id, ev);
            });
          });
        }

        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'No se pudo cargar el renderizador Graphviz');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (panZoomRef.current) {
        try { panZoomRef.current.destroy(); } catch (_) {}
        panZoomRef.current = null;
      }
      if (observerRef.current) {
        try { observerRef.current.disconnect(); } catch (_) {}
        observerRef.current = null;
      }
    };
  }, [dot, panZoom, onNodeClick, minHeight]);

  return (
    <div className={`graphviz-renderer position-relative ${className}`} style={{ minHeight }}>
      {loading && (
        <div className="position-absolute top-50 start-50 translate-middle text-muted small">
          Renderizando diagrama…
        </div>
      )}
      {error && (
        <div className="alert alert-warning small mb-0">
          No se pudo renderizar el diagrama: {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="graphviz-canvas"
        style={{ width: '100%', minHeight, overflow: 'hidden' }}
      />
    </div>
  );
});

export default GraphvizRenderer;
