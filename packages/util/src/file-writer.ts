export interface FileWriter {
  addLine(line: any): Promise<void>;
  close(): Promise<void>;
}

export class FallbackFileWriter {
  readonly out: string[] = [];

  constructor(private options: SaveFilePickerOptions) {}

  async addLine(value: any) {
    this.out.push(JSON.stringify(value));
    this.out.push('\n');
  }

  async close() {
    const blobConfig = new Blob(this.out, { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blobConfig);

    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.target = '_blank';
    anchor.download = this.options.suggestedName ?? 'download.txt';
    // iterate through all things being linked to or from
    //
    // Auto click on a element, trigger the file download
    anchor.click();

    // This is required
    URL.revokeObjectURL(blobUrl);
  }
}

export class StreamingFileWriter {
  static isSupported(): boolean {
    return !!window.showSaveFilePicker;
  }

  static async create(options: SaveFilePickerOptions): Promise<FileWriter> {
    if (!this.isSupported()) {
      return new FallbackFileWriter(options);
    } else {
      // create a new handle
      const fileSystemFileHandle = await window.showSaveFilePicker();

      // create a FileSystemWritableFileStream to write to
      const writableStream = await fileSystemFileHandle.createWritable();
      return new StreamingFileWriter(writableStream);
    }
  }

  private constructor(private writableStream: FileSystemWritableFileStream) {}

  async addLine(line: any) {
    await this.writableStream.write(JSON.stringify(line) + '\n');
  }

  async close() {
    // close the file and write the contents to disk.
    await this.writableStream.close();
  }
}
