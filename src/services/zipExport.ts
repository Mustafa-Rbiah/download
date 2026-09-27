import JSZip from 'jszip';
import { EmailItem, EmailCategory, CleanHeadersConfig } from '../types.js';
import { sanitizeFilename } from './gmail.js';
import { cleanAndFormatEmlBytes } from './headerCleaner.js';

export interface ZipExportResult {
  filename: string;
  totalFiles: number;
  totalSize: number;
  blob: Blob;
}

/**
 * Package downloaded EML files into a zip file named mails_[date]_[time].zip
 * and trigger an automatic browser download.
 * If cleanHeaders is enabled, applies the header cleaning & formatting pipeline
 * using the provided CleanHeadersConfig before saving each .eml file.
 */
export async function packageAndDownloadEmls(
  emails: { item: EmailItem; rawBytes: Uint8Array }[],
  category?: EmailCategory,
  cleanHeadersConfig?: boolean | CleanHeadersConfig
): Promise<ZipExportResult> {
  const zip = new JSZip();

  const isCleanEnabled =
    typeof cleanHeadersConfig === 'boolean'
      ? cleanHeadersConfig
      : cleanHeadersConfig?.enabled ?? false;

  const configObj =
    typeof cleanHeadersConfig === 'object' ? cleanHeadersConfig : undefined;

  // Create date and time stamp YYYY-MM-DD_HH-mm-ss
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}-${minutes}-${seconds}`;
  const zipFilename = `mails_${dateStr}_${timeStr}.zip`;

  // Track unique filenames inside zip
  const nameOccurrences = new Map<string, number>();

  emails.forEach(({ item, rawBytes }) => {
    let cleanSubject = sanitizeFilename(item.subject || 'email');
    if (!cleanSubject) cleanSubject = 'email';

    let filename = `${item.id}_${cleanSubject}.eml`;
    const count = nameOccurrences.get(filename) || 0;
    if (count > 0) {
      filename = `${item.id}_${cleanSubject}_(${count}).eml`;
    }
    nameOccurrences.set(filename, count + 1);

    // Apply header cleaning pipeline if option enabled; body remains 100% untouched byte-for-byte
    const fileBytes = isCleanEnabled
      ? cleanAndFormatEmlBytes(rawBytes, configObj)
      : rawBytes;
    zip.file(filename, fileBytes);
  });

  // Generate zip as Blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Trigger automatic download
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = zipFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);

  return {
    filename: zipFilename,
    totalFiles: emails.length,
    totalSize: blob.size,
    blob,
  };
}
