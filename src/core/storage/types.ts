export interface StoredFileResult {
  storageKey: string;
  key?: string;
  publicUrl?: string;
  url?: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

export interface StorageProvider {
  savePublicMedia(params: {
    tenantId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    optimizeImage?: boolean;
  }): Promise<StoredFileResult>;

  savePrivateDigitalFile(params: {
    tenantId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<StoredFileResult>;

  readPrivateFile(storageKey: string): Promise<Buffer>;
  readPublicFile(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string, isPrivate: boolean): Promise<void>;
}

