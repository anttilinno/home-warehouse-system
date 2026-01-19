"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Skeleton } from "@/components/ui/skeleton";

const ENTITY_TYPES = [
  { value: "items", label: "Items" },
  { value: "inventory", label: "Inventory" },
  { value: "locations", label: "Locations" },
  { value: "containers", label: "Containers" },
  { value: "categories", label: "Categories" },
  { value: "borrowers", label: "Borrowers" },
];

export default function NewImportPage() {
  const router = useRouter();
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [entityType, setEntityType] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);

    // Check file type
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are supported");
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setFile(file);
  };

  if (workspaceLoading) {
    return (
      <div className="container mx-auto py-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/imports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Imports
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold">New Import</h1>
          <p className="text-muted-foreground mt-2">
            Upload a CSV file to bulk import data
          </p>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpload = async () => {
    if (!entityType) {
      setError("Please select an entity type");
      return;
    }

    if (!file) {
      setError("Please select a file");
      return;
    }

    if (!workspaceId) {
      setError("Workspace not found");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity_type", entityType);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/imports/upload`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      const data = await response.json();
      router.push(`/dashboard/imports/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/imports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Imports
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">New Import</h1>
        <p className="text-muted-foreground mt-2">
          Upload a CSV file to bulk import data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Configuration</CardTitle>
          <CardDescription>Select the type of data you want to import</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="entity-type">Entity Type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger id="entity-type">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>CSV File</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {file ? (
                  <div className="space-y-2">
                    <FileText className="h-12 w-12 mx-auto text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="font-medium">
                      Drag and drop your CSV file here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Maximum file size: 10MB
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={!entityType || !file || isUploading}
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Start Import"}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/imports">Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          <strong>CSV Format Requirements:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>First row must contain column headers</li>
            <li>Headers should match the entity field names (e.g., name, sku, description)</li>
            <li>Use lowercase headers with underscores (e.g., serial_number)</li>
            <li>Required fields must be present in all rows</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
