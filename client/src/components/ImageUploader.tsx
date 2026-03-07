import { useRef, useState } from "react";
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

  const handleFiles = async (files: FileList | null) => {
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

      {/* 上传按钮 */}
      {images.length < maxCount && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-xs h-8"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />上传中...</>
            ) : (
              <><Upload className="w-3.5 h-3.5" />上传{label}图片</>
            )}
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            支持 JPG/PNG/PDF，最多 {maxCount} 张，单张 ≤10MB
          </span>
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
