/** A file to upload; a browser File fits this shape. */
export interface UploadFile {
  readonly name: string
  readonly size: number
  arrayBuffer(): Promise<ArrayBuffer>
}
