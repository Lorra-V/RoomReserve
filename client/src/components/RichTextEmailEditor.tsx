import { useRef, useMemo, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Image, Eye, RotateCcw } from "lucide-react";

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

  const insertVariable = useCallback((tag: string) => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection(true);
      quill.insertText(range.index, tag);
      quill.setSelection(range.index + tag.length, 0);
    }
  }, []);

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
          ["link"],
          ["clean"],
        ],
      },
    }),
    []
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
    </div>
  );
}
