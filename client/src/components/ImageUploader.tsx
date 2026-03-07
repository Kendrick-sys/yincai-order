import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Upload, X, ZoomIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  label: string;
  category: string;           // "sticker" | "silkprint" | "liner"
  images: string[];           // 当前图片 URL 列表
  onChange: (urls: string[]) => void;
  maxCount?: number;
}

export default function ImageUploader({
  label, category, images, onChange, maxCount = 5,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxCount - images.length;
    if (remaining <= 0) { toast.warning(`最多上传 ${maxCount} 张图片`); return; }
    const toUpload = Array.from(files).slice(0, remaining);

    setUploading(true);
    const newUrls: string[] = [];
    for (const file of toUpload) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} 超过 10MB 限制`); continue; }
      try {
        const base64 = await fileToBase64(file);
        const res = await fetch("/api/upload/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ base64, mimeType: file.type, category }),
        });
        if (!res.ok) throw new Error("上传失败");
        const { url } = await res.json();
        newUrls.push(url);
      } catch {
        toast.error(`${file.name} 上传失败`);
      }
    }
    setUploading(false);
    if (newUrls.length > 0) {
      onChange([...images, ...newUrls]);
      toast.success(`成功上传 ${newUrls.length} 张图片`);
    }
  };

  const removeImage = (idx: number) => {
    const next = [...images];
    next.splice(idx, 1);
    onChange(next);
  };

  // ── 拖拽事件处理 ──────────────────────────────────────────────────────────────
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length >= maxCount) return;
    setIsDragging(true);
  }, [images.length, maxCount]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有真正离开区域才取消高亮（避免子元素触发 leave）
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (images.length >= maxCount) {
      toast.warning(`最多上传 ${maxCount} 张图片`);
      return;
    }
    const files = e.dataTransfer.files;
    // 过滤只保留图片和 PDF
    const imageFiles = Array.from(files).filter(f =>
      f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (imageFiles.length === 0) {
      toast.error("请拖入图片或 PDF 文件");
      return;
    }
    handleFiles(imageFiles);
  }, [images.length, maxCount]);

  const canUpload = images.length < maxCount;

  return (
    <div className="space-y-2">
      {/* 图片网格 */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreview(url)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="w-7 h-7 rounded-full bg-red-500/70 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 拖拽 + 点击上传区域 */}
      {canUpload && (
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={[
            "flex items-center gap-3 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-150 select-none",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
            uploading ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          ) : (
            <Upload className={`w-4 h-4 flex-shrink-0 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          )}
          <div className="flex flex-col">
            <span className={`text-xs font-medium transition-colors ${isDragging ? "text-primary" : "text-foreground/70"}`}>
              {uploading
                ? "上传中..."
                : isDragging
                  ? "松开鼠标即可上传"
                  : `上传${label}图片（点击或拖拽）`}
            </span>
            <span className="text-xs text-muted-foreground">
              支持 JPG/PNG/PDF，最多 {maxCount} 张，单张 ≤10MB
            </span>
          </div>
        </div>
      )}

      {/* 大图预览 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={preview} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // 去掉 data:xxx;base64, 前缀
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
