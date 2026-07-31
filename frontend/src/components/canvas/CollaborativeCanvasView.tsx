import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getSocket } from "@/lib/socket";
import {
  Pencil,
  Eraser,
  Square,
  Circle,
  ArrowRight,
  Type,
  Image as ImageIcon,
  MousePointer,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui";

export type ToolMode = "select" | "pen" | "eraser" | "rectangle" | "circle" | "arrow" | "text";

export interface CanvasElement {
  id: string;
  type: ToolMode | "image";
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  text?: string;
  imageUrl?: string;
}

export default function CollaborativeCanvasView() {
  const { channelId } = useParams<{ channelId?: string }>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<ToolMode>("pen");
  const [color, setColor] = useState("#3b82f6");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const currentElement = useRef<CanvasElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth || 900;
    canvas.height = 650;
    redrawCanvas();

    const socket = getSocket();
    socket.emit("canvas:join", { channelId });

    const handleCanvasUpdate = (data: { elements: CanvasElement[] }) => {
      setElements(data.elements || []);
    };

    socket.on("canvas:update", handleCanvasUpdate);

    return () => {
      socket.off("canvas:update", handleCanvasUpdate);
    };
  }, [channelId]);

  useEffect(() => {
    redrawCanvas();
  }, [elements, selectedId, color, strokeWidth]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    elements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;

      if (el.id === selectedId) {
        ctx.save();
        ctx.shadowColor = "#3b82f6";
        ctx.shadowBlur = 8;
      }

      switch (el.type) {
        case "pen":
          if (el.points && el.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case "rectangle":
          if (el.width !== undefined && el.height !== undefined) {
            ctx.strokeRect(el.x, el.y, el.width, el.height);
          }
          break;

        case "circle":
          if (el.width !== undefined) {
            ctx.beginPath();
            const radius = Math.abs(el.width) / 2;
            ctx.arc(el.x + radius, el.y + radius, radius, 0, 2 * Math.PI);
            ctx.stroke();
          }
          break;

        case "arrow":
          if (el.width !== undefined && el.height !== undefined) {
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            const endX = el.x + el.width;
            const endY = el.y + el.height;
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Arrow head
            const angle = Math.atan2(el.height, el.width);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - 12 * Math.cos(angle - Math.PI / 6), endY - 12 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - 12 * Math.cos(angle + Math.PI / 6), endY - 12 * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }
          break;

        case "text":
          if (el.text) {
            ctx.font = `${el.strokeWidth * 6 + 12}px sans-serif`;
            ctx.fillText(el.text, el.x, el.y);
          }
          break;

        case "image":
          if (el.imageUrl) {
            const img = new Image();
            img.src = el.imageUrl;
            img.onload = () => {
              ctx.drawImage(img, el.x, el.y, el.width || 150, el.height || 150);
            };
          }
          break;
      }

      if (el.id === selectedId) {
        ctx.restore();
      }
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "select") {
      // Find clicked element
      const clicked = [...elements].reverse().find((el) => {
        if (el.type === "rectangle" || el.type === "circle" || el.type === "image") {
          return x >= el.x && x <= el.x + (el.width || 50) && y >= el.y && y <= el.y + (el.height || 50);
        }
        return Math.hypot(el.x - x, el.y - y) < 30;
      });
      setSelectedId(clicked ? clicked.id : null);
      return;
    }

    if (tool === "text") {
      setEditingText({ id: Date.now().toString(), x, y, text: "" });
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    setIsDrawing(true);
    const newEl: CanvasElement = {
      id: Date.now().toString(),
      type: tool,
      x,
      y,
      color,
      strokeWidth,
      points: tool === "pen" ? [{ x, y }] : undefined,
    };

    currentElement.current = newEl;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const el = currentElement.current;

    if (tool === "pen") {
      el.points = [...(el.points || []), { x, y }];
    } else if (tool === "rectangle" || tool === "circle" || tool === "arrow") {
      el.width = x - el.x;
      el.height = y - el.y;
    }

    setElements((prev) => [...prev.filter((item) => item.id !== el.id), { ...el }]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentElement.current) return;
    setIsDrawing(false);
    const updated = [...elements];
    setElements(updated);

    const socket = getSocket();
    socket.emit("canvas:sync", { channelId, elements: updated });
    currentElement.current = null;
  };

  const handleTextSubmit = () => {
    if (editingText && editingText.text.trim()) {
      const newEl: CanvasElement = {
        id: editingText.id,
        type: "text",
        x: editingText.x,
        y: editingText.y,
        text: editingText.text,
        color,
        strokeWidth,
      };
      const updated = [...elements, newEl];
      setElements(updated);
      const socket = getSocket();
      socket.emit("canvas:sync", { channelId, elements: updated });
    }
    setEditingText(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newEl: CanvasElement = {
        id: Date.now().toString(),
        type: "image",
        x: 100,
        y: 100,
        width: 180,
        height: 180,
        imageUrl: reader.result as string,
        color: "#000000",
        strokeWidth: 1,
      };
      const updated = [...elements, newEl];
      setElements(updated);
      const socket = getSocket();
      socket.emit("canvas:sync", { channelId, elements: updated });
    };
    reader.readAsDataURL(file);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const updated = elements.filter((el) => el.id !== selectedId);
    setElements(updated);
    setSelectedId(null);
    const socket = getSocket();
    socket.emit("canvas:sync", { channelId, elements: updated });
  };

  const clearCanvas = () => {
    setElements([]);
    setSelectedId(null);
    const socket = getSocket();
    socket.emit("canvas:sync", { channelId, elements: [] });
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-hairline/60 overflow-hidden">
      {/* Rich Canvas Toolbar */}
      <div className="px-6 py-3 border-b border-hairline/60 flex items-center justify-between bg-surface/80 backdrop-blur-md flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-canvas-soft/60 p-1 rounded-xl border border-hairline/60">
          <button
            onClick={() => setTool("select")}
            className={`p-2 rounded-lg transition-colors ${tool === "select" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"}`}
            title="Select & Move"
          >
            <MousePointer size={16} />
          </button>
          <button
            onClick={() => setTool("pen")}
            className={`p-2 rounded-lg transition-colors ${tool === "pen" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"}`}
            title="Freehand Pencil"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => setTool("rectangle")}
            className={`p-2 rounded-lg transition-colors ${tool === "rectangle" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"}`}
            title="Rectangle Shape"
          >
            <Square size={16} />
          </button>
          <button
            onClick={() => setTool("circle")}
            className={`p-2 rounded-lg transition-colors ${tool === "circle" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"}`}
            title="Circle Shape"
          >
            <Circle size={16} />
          </button>
          <button
            onClick={() => setTool("arrow")}
            className={`p-2 rounded-lg transition-colors ${tool === "arrow" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"}`}
            title="Arrow Line"
          >
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => setTool("text")}
            className={`p-2 rounded-lg transition-colors ${tool === "text" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"}`}
            title="Text Box"
          >
            <Type size={16} />
          </button>

          {/* Image Upload Button */}
          <label className="p-2 rounded-lg text-ink-muted hover:text-ink cursor-pointer hover:bg-canvas-soft" title="Insert Image">
            <ImageIcon size={16} />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>

        {/* Color & Stroke Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#000000"].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? "scale-125 border-primary" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="px-2 py-1 rounded bg-canvas-soft border border-hairline/60 text-caption text-ink"
          >
            <option value={2}>Thin (2px)</option>
            <option value={4}>Medium (4px)</option>
            <option value={8}>Thick (8px)</option>
          </select>

          {/* Delete Selected Element Button */}
          {selectedId && (
            <Button variant="danger" onClick={deleteSelected} size="sm">
              <Trash2 size={14} /> Delete Selected
            </Button>
          )}

          <Button variant="secondary" onClick={clearCanvas} size="sm">
            <RotateCcw size={14} /> Clear All
          </Button>
        </div>
      </div>

      {/* HTML5 Canvas Drawing Area */}
      <div className="flex-1 bg-white relative overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full block"
        />

        {/* Floating Text Input Box */}
        {editingText && (
          <input
            ref={textInputRef}
            type="text"
            value={editingText.text}
            onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
            onBlur={handleTextSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
            style={{ position: "absolute", left: editingText.x, top: editingText.y, color, fontSize: `${strokeWidth * 6 + 12}px` }}
            className="bg-transparent border-b-2 border-primary focus:outline-none font-sans"
            placeholder="Type text..."
          />
        )}
      </div>
    </div>
  );
}
