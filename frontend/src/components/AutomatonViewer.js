import React, { useState, useRef, useEffect } from 'react';
import { Button, Card } from 'react-bootstrap';
import './AutomatonViewer.css';

const AutomatonViewer = ({ states, transitions, actionTable, gotoTable }) => {
  const [zoom, setZoom] = useState(1);
  const [selectedState, setSelectedState] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // Configuración del layout
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 120;
  const SPACING_X = 300;
  const SPACING_Y = 200;
  const COLS = 5;

  // Calcular posiciones de los estados
  const getStatePosition = (index) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    return {
      x: col * SPACING_X + NODE_WIDTH / 2,
      y: row * SPACING_Y + NODE_HEIGHT / 2
    };
  };

  // Encontrar transiciones desde un estado
  const getTransitionsFromState = (stateIndex) => {
    const transitions = [];
    
    // De la tabla de acciones
    if (actionTable && actionTable[stateIndex]) {
      Object.entries(actionTable[stateIndex]).forEach(([symbol, action]) => {
        if (action.type === 'shift') {
          transitions.push({
            from: stateIndex,
            to: action.value,
            symbol: symbol,
            type: 'shift'
          });
        }
      });
    }
    
    // De la tabla GOTO
    if (gotoTable && gotoTable[stateIndex]) {
      Object.entries(gotoTable[stateIndex]).forEach(([symbol, target]) => {
        transitions.push({
          from: stateIndex,
          to: target,
          symbol: symbol,
          type: 'goto'
        });
      });
    }
    
    return transitions;
  };

  // Obtener todas las transiciones
  const getAllTransitions = () => {
    const allTransitions = [];
    states.forEach((_, index) => {
      allTransitions.push(...getTransitionsFromState(index));
    });
    return allTransitions;
  };

  const allTransitions = getAllTransitions();

  // Funciones de zoom
  const handleWheel = React.useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newZoom = Math.min(Math.max(zoom + delta, 0.3), 3);
    setZoom(newZoom);
  }, [zoom]);

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedState(null);
  };

  // Funciones de pan
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = React.useCallback((e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart.x, dragStart.y]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    const svgElement = svgRef.current;
    if (svgElement) {
      svgElement.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (svgElement) {
        svgElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleMouseMove, handleMouseUp, handleWheel]);

  // Renderizar un estado
  const renderState = (state, index) => {
    const pos = getStatePosition(index);
    const isSelected = selectedState === index;
    const isInitial = index === 0;
    const baseRadius = NODE_WIDTH / 3;
    
    return (
      <g key={index}>
        {/* Círculo del estado */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={baseRadius}
          fill={isSelected ? '#007bff' : isInitial ? '#28a745' : '#f8f9fa'}
          stroke={isSelected ? '#0056b3' : isInitial ? '#1e7e34' : '#6c757d'}
          strokeWidth={isSelected ? 3 : 2}
          className="state-circle"
          onClick={() => setSelectedState(selectedState === index ? null : index)}
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => {
            e.target.setAttribute('r', baseRadius + 5);
          }}
          onMouseLeave={(e) => {
            e.target.setAttribute('r', baseRadius);
          }}
        />
        
        {/* Número del estado */}
        <text
          x={pos.x}
          y={pos.y - 20}
          textAnchor="middle"
          className="state-number"
          fontSize="14"
          fontWeight="bold"
          fill={isSelected ? 'white' : 'black'}
        >
          {index}
        </text>
        
        {/* Items del estado (simplified) */}
        <text
          x={pos.x}
          y={pos.y + 5}
          textAnchor="middle"
          className="state-items"
          fontSize="10"
          fill={isSelected ? 'white' : '#495057'}
        >
          {state.items.length} items
        </text>
        
        {/* Indicador de estado inicial */}
        {isInitial && (
          <text
            x={pos.x}
            y={pos.y + 20}
            textAnchor="middle"
            fontSize="8"
            fill="#28a745"
            fontWeight="bold"
          >
            START
          </text>
        )}
      </g>
    );
  };

  // Renderizar una transición
  const renderTransition = (transition, index) => {
    const fromPos = getStatePosition(transition.from);
    const toPos = getStatePosition(transition.to);
    
    const isHighlighted = selectedState === transition.from || selectedState === transition.to;
    const isFromSelected = selectedState === transition.from;
    const isToSelected = selectedState === transition.to;
    
    // Calcular punto medio para la etiqueta
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    
    // Calcular ángulo para orientar la flecha
    const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
    const arrowLength = 10;
    
    // Ajustar puntos de inicio y fin para que no se superpongan con los círculos
    const radius = NODE_WIDTH / 3;
    const startX = fromPos.x + Math.cos(angle) * radius;
    const startY = fromPos.y + Math.sin(angle) * radius;
    const endX = toPos.x - Math.cos(angle) * radius;
    const endY = toPos.y - Math.sin(angle) * radius;
    
    return (
      <g key={`transition-${index}`}>
        {/* Línea de la transición */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={isFromSelected ? '#007bff' : isToSelected ? '#ffc107' : isHighlighted ? '#6c757d' : '#6c757d'}
          strokeWidth={isFromSelected || isToSelected ? 3 : isHighlighted ? 2 : 1}
          className="transition-line"
          opacity={selectedState === null || isHighlighted ? 1 : 0.3}
        />
        
        {/* Punta de flecha */}
        <polygon
          points={`${endX},${endY} ${endX - arrowLength * Math.cos(angle - Math.PI/6)},${endY - arrowLength * Math.sin(angle - Math.PI/6)} ${endX - arrowLength * Math.cos(angle + Math.PI/6)},${endY - arrowLength * Math.sin(angle + Math.PI/6)}`}
          fill={isFromSelected ? '#007bff' : isToSelected ? '#ffc107' : isHighlighted ? '#6c757d' : '#6c757d'}
          opacity={selectedState === null || isHighlighted ? 1 : 0.3}
        />
        
        {/* Etiqueta de la transición */}
        <text
          x={midX}
          y={midY - 5}
          textAnchor="middle"
          fontSize="10"
          fill={isFromSelected ? '#007bff' : isToSelected ? '#856404' : isHighlighted ? '#495057' : '#495057'}
          className="transition-label"
          opacity={selectedState === null || isHighlighted ? 1 : 0.5}
        >
          {transition.symbol}
        </text>
        
        {/* Tipo de transición */}
        <text
          x={midX}
          y={midY + 8}
          textAnchor="middle"
          fontSize="8"
          fill={transition.type === 'shift' ? '#dc3545' : '#17a2b8'}
          className="transition-type"
          opacity={selectedState === null || isHighlighted ? 0.8 : 0.3}
        >
          {transition.type}
        </text>
      </g>
    );
  };

  if (!states || states.length === 0) {
    return (
      <div className="alert alert-info">
        <h5>📊 Autómata LR(1)</h5>
        <p>No hay estados disponibles para mostrar.</p>
      </div>
    );
  }

  const viewBox = {
    width: Math.max(COLS * SPACING_X, 1000),
    height: Math.max(Math.ceil(states.length / COLS) * SPACING_Y, 600)
  };

  return (
    <div className="automaton-viewer">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">📊 Autómata LR(1)</h5>
            <small className="text-muted">Usa la rueda del mouse para hacer zoom</small>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="legend-container">
              <div className="legend-item">
                <span className="legend-color outgoing"></span>
                <small>Salientes</small>
              </div>
              <div className="legend-item">
                <span className="legend-color incoming"></span>
                <small>Entrantes</small>
              </div>
            </div>
            <Button variant="outline-secondary" size="sm" onClick={handleResetView}>
              🔄 Vista completa
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="automaton-container">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
              className="automaton-svg"
              onMouseDown={handleMouseDown}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
            >
              {/* Renderizar transiciones primero (para que estén debajo) */}
              {allTransitions.map((transition, index) => 
                renderTransition(transition, index)
              )}
              
              {/* Renderizar estados encima */}
              {states.map((state, index) => renderState(state, index))}
            </svg>
          </div>
          
          {selectedState !== null && (
            <div className="state-details">
              <h6>Estado {selectedState} - Items:</h6>
              <div className="items-list">
                {states[selectedState].items.map((item, i) => (
                  <div key={i} className="item-detail">
                    <code>{item.display}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default AutomatonViewer;
