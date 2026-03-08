import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Upload, X, ZoomIn, Loader2, Clipboard } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  // uploading: 点击/拖拽上传中；pasteUploading: 粘贴上传中（独立状态）
  const [uploading, setUploading] = useState(false);
  const [pasteUploading, setPasteUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // 鼠标是否悬停在本组件的上传区域上
  const [isHovered, setIsHovered] = useState(false);

  // ── 核心上传逻辑 ──────────────────────────────────────────────────────────────
  const uploadFiles = useCallback(async (
    files: File[],
    mode: "normal" | "paste" = "normal"
  ) => {
    if (files.length === 0) return;
    const remaining = maxCount - images.length;
    if (remaining <= 0) { toast.warning(`最多上传 ${maxCount} 张图片`); return; }
    const toUpload = files.slice(0, remaining);

    if (mode === "paste") setPasteUploading(true);
    else setUploading(true);

    const newUrls: string[] = [];
    for (const file of toUpload) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name || "图片"} 超过 10MB 限制`); continue; }
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
        toast.error(`${file.name || "图片"} 上传失败`);
      }
    }

    if (mode === "paste") setPasteUploading(false);
    else setUploading(false);

    if (newUrls.length > 0) {
      onChange([...images, ...newUrls]);
      toast.success(
        mode === "paste"
          ? `粘贴上传成功 ${newUrls.length} 张图片`
          : `成功上传 ${newUrls.length} 张图片`
      );
    }
  }, [images, maxCount, onChange, category]);

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const filtered = Array.from(files).filter(f =>
      f.type.startsWith("image/") || f.type === "application/pdf"
    );
    uploadFiles(filtered, "normal");
  }, [uploadFiles]);

  // ── 粘贴事件：只在本组件上传区悬停时响应 ────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // 未悬停在本区域时，不拦截
      if (!isHovered) return;

      // 焦点在文本输入框内时，不拦截
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;

      if (images.length >= maxCount) {
        toast.warning(`最多上传 ${maxCount} 张图片`);
        return;
      }

      e.preventDefault(); // 阻止其他区域响应同一次粘贴
      uploadFiles(imageFiles, "paste");
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isHovered, images.length, maxCount, uploadFiles]);

  const removeImage = (idx: number) => {
    const next = [...images];
    next.splice(idx, 1);
    onChange(next);
  };

  // ── 拖拽事件 ──────────────────────────────────────────────────────────────────
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (images.length >= maxCount) return;
    setIsDragging(true);
  }, [images.length, maxCount]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (images.length >= maxCount) { toast.warning(`最多上传 ${maxCount} 张图片`); return; }
    const imageFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (imageFiles.length === 0) { toast.error("请拖入图片或 PDF 文件"); return; }
    uploadFiles(imageFiles, "normal");
  }, [images.length, maxCount, uploadFiles]);

  const canUpload = images.length < maxCount;
  const isAnyUploading = uploading || pasteUploading;

  // ── 上传区样式 ────────────────────────────────────────────────────────────────
  const uploadAreaClass = [
    "relative flex items-center gap-3 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-150 select-none overflow-hidden",
    isDragging
      ? "border-primary bg-primary/5 scale-[1.01]"
      : isHovered && !isAnyUploading
        ? "border-primary/60 bg-primary/5"
        : "border-border hover:border-primary/50 hover:bg-muted/40",
    isAnyUploading ? "pointer-events-none" : "",
  ].join(" ");

  return (
    <div className="space-y-2">
      {/* 图片网格 */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button type="button" onClick={() => setPreview(url)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors">
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => removeImage(idx)}
                  className="w-7 h-7 rounded-full bg-red-500/70 hover:bg-red-500 flex items-center justify-center text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 上传区域 */}
      {canUpload && (
        <div
          ref={containerRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => !isAnyUploading && inputRef.current?.click()}
          className={uploadAreaClass}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />

          {/* 粘贴上传专属加载动画覆盖层 */}
          {pasteUploading && (
            <div className="absolute inset-0 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center gap-2 rounded-lg z-10">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs font-medium text-primary">正在上传粘贴的图片...</span>
            </div>
          )}

          {/* 图标区 */}
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          ) : pasteUploading ? (
            <Clipboard className="w-4 h-4 flex-shrink-0 text-primary opacity-0" />
          ) : isHovered ? (
            <Clipboard className="w-4 h-4 flex-shrink-0 text-primary transition-colors" />
          ) : (
            <Upload className={`w-4 h-4 flex-shrink-0 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          )}

          {/* 文字区 */}
          <div className="flex flex-col">
            <span className={`text-xs font-medium transition-colors ${isDragging ? "text-primary" : isHovered ? "text-primary" : "text-foreground/70"}`}>
              {uploading
                ? "上传中..."
                : isDragging
                  ? "松开鼠标即可上传"
                  : isHovered
                    ? `上传${label}图片（点击、拖拽或 Ctrl+V 粘贴）`
                    : `上传${label}图片（点击或拖拽）`}
            </span>
            <span className="text-xs text-muted-foreground">
              支持 JPG/PNG/PDF，最多 {maxCount} 张，单张 ≤10MB
              {!uploading && !isDragging && !isHovered && (
                <span className="ml-1 text-muted-foreground/60">· 悬停后可 Ctrl+V 粘贴截图</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* 大图预览 */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={preview} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button onClick={() => setPreview(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-gray-100">
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
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
