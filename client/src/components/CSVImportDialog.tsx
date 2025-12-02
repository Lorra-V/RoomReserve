import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, CheckCircle2, XCircle, AlertCircle, FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File, columnMapping: Record<string, string>) => Promise<{
    created?: number;
    updated?: number;
    errors?: Array<{ row: number; error: string }>;
  }>;
  title?: string;
  description?: string;
  requiredColumns: string[];
  optionalColumns?: string[];
  templateHeaders?: string[];
}

type ImportStep = "upload" | "mapping" | "results";

export default function CSVImportDialog({
  open,
  onOpenChange,
  onImport,
  title = "Import CSV",
  description = "Upload and map your CSV file",
  requiredColumns,
  optionalColumns = [],
  templateHeaders,
}: CSVImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResults, setImportResults] = useState<{
    created?: number;
    updated?: number;
    errors?: Array<{ row: number; error: string }>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      alert("Please select a CSV file");
      return;
    }

    setFile(selectedFile);

    // Parse CSV headers
    const text = await selectedFile.text();
    const lines = text.split("\n");
    if (lines.length > 0) {
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      setCsvHeaders(headers);

      // Auto-map columns based on similarity
      const autoMapping: Record<string, string> = {};
      [...requiredColumns, ...optionalColumns].forEach(expectedCol => {
        const normalizedExpected = expectedCol.toLowerCase().replace(/\s+/g, "");
        const matchedHeader = headers.find(h => 
          h.toLowerCase().replace(/\s+/g, "").includes(normalizedExpected) ||
          normalizedExpected.includes(h.toLowerCase().replace(/\s+/g, ""))
        );
        if (matchedHeader) {
          autoMapping[expectedCol] = matchedHeader;
        }
      });
      setColumnMapping(autoMapping);
      setStep("mapping");
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    try {
      const results = await onImport(file, columnMapping);
      setImportResults(results);
      setStep("results");
    } catch (error: any) {
      setImportResults({
        errors: [{ row: 0, error: error.message || "Import failed" }],
      });
      setStep("results");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const allRequiredMapped = requiredColumns.every(col => columnMapping[col]);
  const unmatchedRequired = requiredColumns.filter(col => !columnMapping[col]);
  const unmatchedOptional = optionalColumns.filter(col => !columnMapping[col]);
  const matchedColumns = [...requiredColumns, ...optionalColumns].filter(col => columnMapping[col]);

  const downloadTemplate = () => {
    const headers = templateHeaders || [...requiredColumns, ...optionalColumns];
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
              <FileText className="w-12 h-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium mb-2">Upload CSV File</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Select a CSV file to import data
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Required columns:</p>
                  <div className="flex flex-wrap gap-2">
                    {requiredColumns.map(col => (
                      <Badge key={col} variant="secondary">{col}</Badge>
                    ))}
                  </div>
                  {optionalColumns.length > 0 && (
                    <>
                      <p className="font-medium mt-2">Optional columns:</p>
                      <div className="flex flex-wrap gap-2">
                        {optionalColumns.map(col => (
                          <Badge key={col} variant="outline">{col}</Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="w-full"
            >
              Download CSV Template
            </Button>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4 py-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">File: {file?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Found {csvHeaders.length} columns in your CSV
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Column Mapping</Label>
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-green-500">
                    {matchedColumns.length} Matched
                  </Badge>
                  {unmatchedRequired.length > 0 && (
                    <Badge variant="destructive">
                      {unmatchedRequired.length} Required Missing
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-4">
                  {/* Required columns */}
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground">
                      Required Fields
                    </p>
                    {requiredColumns.map(expectedCol => (
                      <div
                        key={expectedCol}
                        className={cn(
                          "flex items-center gap-3 mb-3 p-3 rounded-lg border",
                          columnMapping[expectedCol]
                            ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                            : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                        )}
                      >
                        <div className="flex-1">
                          <Label className="text-sm font-medium">
                            {expectedCol}
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <Select
                            value={columnMapping[expectedCol] || ""}
                            onValueChange={(value) =>
                              setColumnMapping(prev => ({ ...prev, [expectedCol]: value }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select CSV column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-- None --</SelectItem>
                              {csvHeaders.map(header => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {columnMapping[expectedCol] ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Optional columns */}
                  {optionalColumns.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-3 text-muted-foreground">
                        Optional Fields
                      </p>
                      {optionalColumns.map(expectedCol => (
                        <div
                          key={expectedCol}
                          className={cn(
                            "flex items-center gap-3 mb-3 p-3 rounded-lg border",
                            columnMapping[expectedCol]
                              ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
                              : "bg-muted/50"
                          )}
                        >
                          <div className="flex-1">
                            <Label className="text-sm font-medium">{expectedCol}</Label>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <Select
                              value={columnMapping[expectedCol] || ""}
                              onValueChange={(value) =>
                                setColumnMapping(prev => ({ ...prev, [expectedCol]: value }))
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select CSV column" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">-- None --</SelectItem>
                                {csvHeaders.map(header => (
                                  <SelectItem key={header} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {columnMapping[expectedCol] && (
                            <CheckCircle2 className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {unmatchedRequired.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please map all required columns before importing
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {step === "results" && importResults && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {importResults.created !== undefined && (
                <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium">Created</p>
                  </div>
                  <p className="text-2xl font-bold">{importResults.created}</p>
                </div>
              )}
              {importResults.updated !== undefined && (
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium">Updated</p>
                  </div>
                  <p className="text-2xl font-bold">{importResults.updated}</p>
                </div>
              )}
            </div>

            {importResults.errors && importResults.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <p className="font-medium">Errors ({importResults.errors.length})</p>
                </div>
                <ScrollArea className="h-[200px] border rounded-md p-4 bg-muted/30">
                  <div className="space-y-2">
                    {importResults.errors.map((error, idx) => (
                      <Alert key={idx} variant="destructive" className="py-2">
                        <AlertDescription className="text-xs">
                          <span className="font-medium">Row {error.row}:</span> {error.error}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {(!importResults.errors || importResults.errors.length === 0) && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Import completed successfully with no errors!
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setCsvHeaders([]);
                  setColumnMapping({});
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={!allRequiredMapped || isImporting}
              >
                {isImporting ? "Importing..." : "Import Data"}
              </Button>
            </>
          )}

          {step === "results" && (
            <Button type="button" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

