import type { UploadInfo } from '@/core/library/UploadInfo'

/** An uploaded MIDI file in IndexedDB. Bytes are an ArrayBuffer: older Safari mishandled Blobs in IndexedDB. */
export interface StoredUpload extends UploadInfo {
  readonly bytes: ArrayBuffer
}
