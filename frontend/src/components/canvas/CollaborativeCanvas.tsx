import React, { useRef, useEffect, useState } from 'react';
import { getSocket } from '../../lib/socket';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface CollaborativeCanvasProps {
  channelId: string;
}

export const CollaborativeCanvas: React.FC<CollaborativeCanvasProps> = ({
  channelId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#3B82F6');
  const [width, setWidth] = useState(3);
  const currentStroke = useRef<Point[]>([]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const socket = getSocket();
    socket.emit('room:join', { channelId });

    const handleRemoteDraw = ({ stroke }: { stroke: Stroke }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawStroke(ctx, stroke);
    };

    socket.on('canvas:draw', handleRemoteDraw);

    return () => {
      socket.off('canvas:draw', handleRemoteDraw);
      socket.emit('room:leave', { channelId });
    };
  }, [channelId]);


  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    currentStroke.current = [{ x, y }];
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const points = currentStroke.current;
    points.push({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx && points.length >= 2) {
      drawStroke(ctx, { points: points.slice(-2), color, width });
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke.current.length > 1) {
      const stroke: Stroke = {
        points: currentStroke.current,
        color,
        width,
      };
      const socket = getSocket();
      socket.emit('canvas:draw', { channelId, stroke });
    }
    currentStroke.current = [];
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b pb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Collaborative Whiteboard
        </h3>
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0"
            title="Pick stroke color"
          />
          <input
            type="range"
            min="1"
            max="10"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-20 cursor-pointer"
            title="Stroke width"
          />
          <button
            onClick={clearCanvas}
            className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex-1 relative min-h-[400px]">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 cursor-crosshair"
        />
      </div>
    </div>
  );
};
