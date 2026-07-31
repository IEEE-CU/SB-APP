import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getSocket } from "@/lib/socket";
import { Eraser, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

interface StrokePoint {
  x: number;
  y: number;
}

interface StrokeData {
  color: string;
  width: number;
  points: StrokePoint[];
}

export default function CollaborativeCanvasView() {
  const { channelId } = useParams<{ channelId?: string }>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [width, setWidth] = useState(3);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const currentStroke = useRef<StrokePoint[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = 600;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Socket listeners for live vector drawing synchronization
    const socket = getSocket();
    socket.emit("canvas:join", { channelId });

    const handleStrokeAdded = (data: StrokeData) => {
      drawRemoteStroke(ctx, data);
    };

    socket.on("canvas:stroke-added", handleStrokeAdded);

    return () => {
      socket.off("canvas:stroke-added", handleStrokeAdded);
    };
  }, [channelId]);

  const drawRemoteStroke = (ctx: CanvasRenderingContext2D, stroke: StrokeData) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStroke.current = [{ x, y }];
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const points = currentStroke.current;
    const prevPoint = points[points.length - 1];

    ctx.beginPath();
    ctx.strokeStyle = mode === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = mode === "eraser" ? width * 4 : width;
    ctx.moveTo(prevPoint.x, prevPoint.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    currentStroke.current.push({ x, y });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke.current.length > 1) {
      const strokeData: StrokeData = {
        color: mode === "eraser" ? "#ffffff" : color,
        width: mode === "eraser" ? width * 4 : width,
        points: currentStroke.current,
      };

      const socket = getSocket();
      socket.emit("canvas:draw-stroke", { channelId, strokeData });
    }
    currentStroke.current = [];
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-hairline/60 overflow-hidden">
      {/* Canvas Toolbar */}
      <div className="px-6 py-3 border-b border-hairline/60 flex items-center justify-between bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode("pen")}
            className={`p-2 rounded-lg border transition-colors ${
              mode === "pen" ? "bg-primary/10 border-primary text-primary" : "border-hairline text-ink-muted hover:text-ink"
            }`}
            title="Pencil"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setMode("eraser")}
            className={`p-2 rounded-lg border transition-colors ${
              mode === "eraser" ? "bg-primary/10 border-primary text-primary" : "border-hairline text-ink-muted hover:text-ink"
            }`}
            title="Eraser"
          >
            <Eraser size={18} />
          </button>

          <div className="w-px h-5 bg-hairline" />

          {/* Color Palette */}
          <div className="flex items-center gap-1.5">
            {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#000000"].map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setMode("pen");
                }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  color === c && mode === "pen" ? "scale-125 border-primary" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-hairline" />

          {/* Stroke Width Selector */}
          <select
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="px-2 py-1 rounded bg-canvas-soft border border-hairline/60 text-caption text-ink"
          >
            <option value={2}>Thin (2px)</option>
            <option value={4}>Medium (4px)</option>
            <option value={8}>Thick (8px)</option>
          </select>
        </div>

        <Button variant="secondary" onClick={clearCanvas}>
          <RotateCcw size={16} /> Clear Canvas
        </Button>
      </div>

      {/* HTML5 Canvas Surface */}
      <div className="flex-1 bg-white relative overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
}
