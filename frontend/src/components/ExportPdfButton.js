import React from 'react';
import { Button } from 'react-bootstrap';
import { exportParserResultToPdf } from '../utils/exportTablesPdf';

/**
 * @param {object} props
 * @param {object} [props.result] - respuesta única de /api/parse
 * @param {boolean} [props.compare]
 * @param {object} [props.left]
 * @param {object} [props.right]
 * @param {string} [props.leftLabel]
 * @param {string} [props.rightLabel]
 */
const ExportPdfButton = ({ result, compare, left, right, leftLabel, rightLabel }) => {
  const handleClick = () => {
    try {
      if (compare && left && right) {
        const a = (leftLabel || 'A').replace(/[^a-zA-Z0-9-_]/g, '_');
        const b = (rightLabel || 'B').replace(/[^a-zA-Z0-9-_]/g, '_');
        exportParserResultToPdf(left, `comparar-${a}`);
        exportParserResultToPdf(right, `comparar-${b}`);
        return;
      }
      if (result) {
        const base =
          (result.parser_label || result.parser || 'informe').replace(/[^a-zA-Z0-9-_]/g, '_');
        exportParserResultToPdf(result, base);
      }
    } catch (e) {
      console.error(e);
      window.alert('No se pudo generar el PDF. Revisa la consola.');
    }
  };

  const disabled = compare ? !left || !right : !result;

  return (
    <Button variant="outline-danger" size="sm" onClick={handleClick} disabled={disabled}>
      Exportar tablas (PDF)
    </Button>
  );
};

export default ExportPdfButton;
