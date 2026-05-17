import React, { useState } from 'react';
import { DropdownButton, Dropdown } from 'react-bootstrap';
import { instance } from '@viz-js/viz';

let vizPromise = null;
const getViz = () => {
  if (!vizPromise) vizPromise = instance();
  return vizPromise;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const safeName = (s) => (s || 'graph').replace(/[^a-zA-Z0-9_-]+/g, '_');

/**
 * Botón dropdown que descarga el grafo Graphviz como .dot o .png.
 *
 * Props:
 *   dot      - string DOT (obligatorio)
 *   filename - nombre base sin extensión
 *   variant  - bootstrap variant (default 'outline-success')
 *   size     - bootstrap size (default 'sm')
 */
const ExportDotButton = ({ dot, filename = 'graph', variant = 'outline-success', size = 'sm' }) => {
  const [busy, setBusy] = useState(false);

  const handleDot = () => {
    if (!dot) return;
    const blob = new Blob([dot], { type: 'text/vnd.graphviz' });
    downloadBlob(blob, `${safeName(filename)}.dot`);
  };

  const handlePng = async () => {
    if (!dot || busy) return;
    setBusy(true);
    try {
      const viz = await getViz();
      const svgEl = viz.renderSVGElement(dot);

      // Serializar el SVG y rasterizarlo en un canvas.
      const xml = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      const loaded = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      img.src = svgUrl;
      await loaded;

      // Dimensiones desde el SVG (viewBox o width/height); fallback a 1200x800.
      const vb = svgEl.viewBox?.baseVal;
      const w = Math.max(vb?.width || svgEl.width?.baseVal?.value || 1200, 400);
      const h = Math.max(vb?.height || svgEl.height?.baseVal?.value || 800, 300);
      const scale = 2; // export en mejor resolución

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);

      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${safeName(filename)}.png`);
      }, 'image/png');
    } catch (e) {
      console.error(e);
      window.alert('No se pudo generar el PNG. Revisa la consola.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownButton
      variant={variant}
      size={size}
      title={busy ? 'Generando…' : 'Exportar grafo'}
      disabled={!dot || busy}
    >
      <Dropdown.Item onClick={handleDot}>Descargar .dot (Graphviz)</Dropdown.Item>
      <Dropdown.Item onClick={handlePng}>Descargar .png (imagen)</Dropdown.Item>
    </DropdownButton>
  );
};

export default ExportDotButton;
