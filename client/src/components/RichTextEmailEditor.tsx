import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Image, Eye, RotateCcw, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateVariable {
  name: string;
  tag: string;
  description: string;
}

interface RichTextEmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variables?: TemplateVariable[];
  showPreview?: boolean;
  previewData?: Record<string, string>;
}

const defaultVariables: TemplateVariable[] = [
  { name: "Customer Name", tag: "{{customerName}}", description: "Customer's first name" },
  { name: "Customer Email", tag: "{{customerEmail}}", description: "Customer's email address" },
  { name: "Room Name", tag: "{{roomName}}", description: "Name of the booked room" },
  { name: "Booking Date", tag: "{{bookingDate}}", description: "Date of the booking" },
  { name: "Start Time", tag: "{{startTime}}", description: "Start time of booking" },
  { name: "End Time", tag: "{{endTime}}", description: "End time of booking" },
  { name: "Centre Name", tag: "{{centreName}}", description: "Your centre's name" },
  { name: "Centre Address", tag: "{{centreAddress}}", description: "Centre's address" },
  { name: "Centre Phone", tag: "{{centrePhone}}", description: "Centre's phone number" },
  { name: "Centre Email", tag: "{{centreEmail}}", description: "Centre's contact email" },
  { name: "Payment Amount", tag: "{{paymentAmount}}", description: "Booking payment amount" },
  { name: "Booking Status", tag: "{{bookingStatus}}", description: "Current booking status" },
  { name: "Rejection Reason", tag: "{{rejectionReason}}", description: "Reason for rejection (rejection emails only)" },
  { name: "Event Name", tag: "{{eventName}}", description: "Name of the event" },
  { name: "Attendees", tag: "{{attendees}}", description: "Number of attendees" },
];

const defaultPreviewData: Record<string, string> = {
  "{{customerName}}": "John",
  "{{customerEmail}}": "john.doe@example.com",
  "{{roomName}}": "Main Conference Hall",
  "{{bookingDate}}": "Monday, January 15, 2025",
  "{{startTime}}": "9:00 AM",
  "{{endTime}}": "12:00 PM",
  "{{centreName}}": "Arima Community Centre",
  "{{centreAddress}}": "123 Main Street, Arima",
  "{{centrePhone}}": "+1 868 555 0123",
  "{{centreEmail}}": "info@arimacentre.com",
  "{{paymentAmount}}": "$150.00",
  "{{bookingStatus}}": "Approved",
  "{{rejectionReason}}": "Room unavailable due to maintenance",
  "{{eventName}}": "Team Meeting",
  "{{attendees}}": "25",
};

export default function RichTextEmailEditor({
  value,
  onChange,
  placeholder = "Start typing your email template...",
  variables = defaultVariables,
  showPreview = true,
  previewData = defaultPreviewData,
}: RichTextEmailEditorProps) {
  const quillRef = useRef<ReactQuill>(null);
  const [editingImage, setEditingImage] = useState<{ originalSrc: string; newSrc: string } | null>(null);
  const [imageList, setImageList] = useState<Array<{ src: string }>>([]);

  const insertVariable = useCallback((tag: string) => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection(true);
      quill.insertText(range.index, tag);
      quill.setSelection(range.index + tag.length, 0);
    }
  }, []);

  // Extract all images from the HTML content
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, "text/html");
    const images = Array.from(doc.querySelectorAll("img"));
    const imageList = images.map((img) => ({
      src: img.src,
    }));
    setImageList(imageList);
  }, [value]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 500 * 1024) {
        alert("Image must be less than 500KB for email compatibility");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", base64);
          quill.setSelection(range.index + 1, 0);
        }
      };
      reader.readAsDataURL(file);
    };
  }, []);

  const handleReplaceImage = useCallback((oldSrc: string) => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 500 * 1024) {
        alert("Image must be less than 500KB for email compatibility");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const newBase64 = reader.result as string;
        // Replace all occurrences of the old image src with the new one
        const updatedValue = value.replace(new RegExp(oldSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), newBase64);
        onChange(updatedValue);
      };
      reader.readAsDataURL(file);
    };
  }, [value, onChange]);

  const handleDeleteImage = useCallback((imageSrc: string) => {
    // Remove the image from the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, "text/html");
    const images = doc.querySelectorAll("img");
    images.forEach((img) => {
      if (img.src === imageSrc) {
        img.remove();
      }
    });
    const updatedHtml = doc.body.innerHTML;
    onChange(updatedHtml);
  }, [value, onChange]);

  const handleEditImageUrl = useCallback((oldSrc: string, newSrc: string) => {
    if (!newSrc.trim()) {
      alert("Please enter a valid image URL or base64 data URL");
      return;
    }

    // Validate if it's a base64 data URL or a regular URL
    const isBase64 = newSrc.startsWith("data:image/");
    const isUrl = newSrc.startsWith("http://") || newSrc.startsWith("https://");

    if (!isBase64 && !isUrl) {
      alert("Please enter a valid image URL (http:// or https://) or upload an image");
      return;
    }

    // Replace all occurrences of the old image src with the new one
    const updatedValue = value.replace(new RegExp(oldSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), newSrc);
    onChange(updatedValue);
    setEditingImage(null);
  }, [value, onChange]);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          [{ font: [] }],
          [{ size: ["small", false, "large", "huge"] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ align: [] }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: handleImageUpload,
        },
      },
    }),
    [handleImageUpload]
  );

  const formats = [
    "header",
    "font",
    "size",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "list",
    "bullet",
    "align",
    "link",
    "image",
  ];

  const getPreviewHtml = () => {
    let previewHtml = value;
    Object.entries(previewData).forEach(([tag, replacement]) => {
      previewHtml = previewHtml.replace(new RegExp(tag.replace(/[{}]/g, "\\$&"), "g"), `<span style="background-color: #dcfce7; padding: 0 4px; border-radius: 4px;">${replacement}</span>`);
    });
    return previewHtml;
  };

  const handleClear = () => {
    onChange("");
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/30 border-b p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-2">Insert Variable:</span>
          <div className="flex flex-wrap gap-1">
            {variables.slice(0, 7).map((variable) => (
              <Tooltip key={variable.tag}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.tag)}
                    className="h-7 text-xs"
                    data-testid={`button-insert-${variable.tag.replace(/[{}]/g, "")}`}
                  >
                    {variable.name}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{variable.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Inserts: {variable.tag}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="bg-muted/10 border-b p-2 flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">More:</span>
          {variables.slice(7).map((variable) => (
            <Tooltip key={variable.tag}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs hover-elevate"
                  onClick={() => insertVariable(variable.tag)}
                  data-testid={`badge-insert-${variable.tag.replace(/[{}]/g, "")}`}
                >
                  {variable.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{variable.description}</p>
                <p className="text-xs text-muted-foreground mt-1">Inserts: {variable.tag}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b p-2 bg-background">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImageUpload}
            className="gap-2"
            data-testid="button-upload-image"
          >
            <Image className="w-4 h-4" />
            Upload Image
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="gap-2 text-muted-foreground"
            data-testid="button-clear-template"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Images are embedded as base64 (max 500KB each)
          </span>
        </div>

        {imageList.length > 0 && (
          <div className="border-b p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Images in Template ({imageList.length})</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {imageList.map((img, idx) => (
                <div key={idx} className="relative group border rounded-lg overflow-hidden bg-background">
                  <img
                    src={img.src}
                    alt={`Image ${idx + 1}`}
                    className="w-full h-20 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='14' dy='10.5' font-weight='bold' x='50%' y='50%' text-anchor='middle'%3EImage%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingImage({ originalSrc: img.src, newSrc: img.src })}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20"
                      title="Edit image"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReplaceImage(img.src)}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20"
                      title="Replace image"
                    >
                      <Image className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this image?")) {
                          handleDeleteImage(img.src);
                        }
                      }}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20"
                      title="Delete image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className="min-h-[200px]"
          data-testid="rich-text-editor"
        />
      </div>

      {showPreview && value && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Preview (with sample data)</span>
          </div>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
          />
        </Card>
      )}

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <p className="font-medium mb-1">Available Variables Reference:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {variables.map((v) => (
            <div key={v.tag} className="flex items-center gap-2">
              <code className="bg-muted px-1 rounded text-xs">{v.tag}</code>
              <span className="text-muted-foreground">{v.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Image Edit Dialog */}
      <Dialog open={!!editingImage} onOpenChange={(open) => !open && setEditingImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
            <DialogDescription>
              Replace the image URL or upload a new image
            </DialogDescription>
          </DialogHeader>
          {editingImage && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Current Image</Label>
                <div className="border rounded-lg p-2 bg-muted/30">
                  <img
                    src={editingImage.originalSrc}
                    alt="Current"
                    className="max-w-full max-h-48 mx-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23ddd' width='200' height='200'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='16' dy='10.5' font-weight='bold' x='50%' y='50%' text-anchor='middle'%3EInvalid Image%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL or Base64 Data URL</Label>
                <Input
                  id="image-url"
                  value={editingImage.newSrc}
                  onChange={(e) => setEditingImage({ ...editingImage, newSrc: e.target.value })}
                  placeholder="Enter image URL or base64 data URL"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a URL (http:// or https://) or paste a base64 data URL (data:image/...)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Or Upload New Image</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.setAttribute("type", "file");
                    input.setAttribute("accept", "image/*");
                    input.click();
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      if (file.size > 500 * 1024) {
                        alert("Image must be less than 500KB for email compatibility");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = reader.result as string;
                        setEditingImage({ ...editingImage, newSrc: base64 });
                      };
                      reader.readAsDataURL(file);
                    };
                  }}
                  className="w-full"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingImage(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (editingImage) {
                      handleEditImageUrl(editingImage.originalSrc, editingImage.newSrc);
                    }
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
