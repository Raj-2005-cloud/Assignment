import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import Papa from 'papaparse';

interface FileUploadProps {
  onEmailsParsed: (emails: string[]) => void;
  accept?: string;
}

export default function FileUpload({
  onEmailsParsed,
  accept = '.csv,.txt',
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [emailCount, setEmailCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');

  const processFile = useCallback(
    (selectedFile: File) => {
      setError('');
      setFile(selectedFile);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;

        // Try CSV parsing
        const result = Papa.parse(text, {
          header: false,
          skipEmptyLines: true,
          transformHeader: (h: string) => h.trim(),
        });

        const emails: string[] = [];
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        for (const row of result.data as string[][]) {
          for (const cell of row) {
            const matches = String(cell).match(emailRegex);
            if (matches) {
              emails.push(...matches.map((e) => e.toLowerCase()));
            }
          }
        }

        const uniqueEmails = [...new Set(emails)];
        setEmailCount(uniqueEmails.length);

        if (uniqueEmails.length === 0) {
          setError('No valid email addresses found in the file');
        }

        onEmailsParsed(uniqueEmails);
      };

      reader.readAsText(selectedFile);
    },
    [onEmailsParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) processFile(droppedFile);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) processFile(selectedFile);
    },
    [processFile]
  );

  const removeFile = () => {
    setFile(null);
    setEmailCount(0);
    setError('');
    onEmailsParsed([]);
  };

  return (
    <div className="w-full">
      <label className="mb-1.5 block text-sm font-medium text-dark-700">
        Email Recipients (CSV/Text File)
      </label>

      {!file ? (
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
            isDragOver
              ? 'border-brand-500 bg-brand-50'
              : 'border-dark-200 bg-dark-50 hover:border-brand-400 hover:bg-brand-50/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileInput}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <Upload
            className={`mb-3 h-8 w-8 ${isDragOver ? 'text-brand-500' : 'text-dark-400'}`}
          />
          <p className="text-sm font-medium text-dark-700">
            Drop your CSV file here, or{' '}
            <span className="text-brand-600">browse</span>
          </p>
          <p className="mt-1 text-xs text-dark-400">
            CSV or TXT file with email addresses
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dark-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
            <FileText className="h-5 w-5 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-dark-800">
              {file.name}
            </p>
            <p className="text-xs text-dark-400">
              {emailCount > 0 ? (
                <span className="text-emerald-600 font-medium">
                  {emailCount} email{emailCount !== 1 ? 's' : ''} detected
                </span>
              ) : (
                'Parsing...'
              )}
            </p>
          </div>
          <button
            onClick={removeFile}
            className="rounded-lg p-1.5 text-dark-400 transition-colors hover:bg-dark-100 hover:text-dark-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
