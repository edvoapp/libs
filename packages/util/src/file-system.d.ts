export declare global {
  export interface Window {
    /** Shows a file picker that allows a user to select a file or multiple files and returns a handle for the file(s). */
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;

    /** Shows a file picker that allows a user to save a file, either by selecting an existing file, or entering a name for a new file. */
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;

    /** Shows a directory picker which allows the user to select a directory. */
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  export type USVString = string;

  export interface FilePickerAcceptType {
    /** An optional description of the category of files types allowed. */
    description: USVString;

    /** An Object with the keys set to the MIME type and the values an Array of file extensions (see below for an example). */
    accept: Record<USVString, USVString | USVString[]>;
  }

  export interface FilePickerOptions {
    /** An Array of allowed file types to save. */
    types?: FilePickerAcceptType[];

    /** A Boolean. Default false. By default the picker should include an option to not apply any file type filters (instigated with the type option below). Setting this option to true means that option is not available. */
    excludeAcceptAllOption?: boolean;

    id?: DOMString;

    startIn?: StartInDirectory;
  }

  export interface OpenFilePickerOptions {
    /** A Boolean. Default false. When set to true multiple files may be selected. */
    multiple?: boolean;
  }

  export interface SaveFilePickerOptions {
    /** A String. The suggested file name. */
    suggestedName?: USVString;
  }

  export interface DirectoryPickerOptions {
    id?: DOMString;
    startIn?: StartInDirectory;
  }

  /** An object which specifies the permission mode to query for. Options are as follows: */
  export interface FileSystemHandlePermissionDescriptor {
    /** Can be either 'read' or 'readwrite'. */
    mode: 'read' | 'readwrite';
  }

  export interface FileSystemHandle {
    readonly kind: 'file' | 'directory';

    /** Compares two handles to see if the associated entries (either a file or directory) match. */
    isSameEntry(
      /** The FileSystemHandle to match against the handle on which the method is invoked. */
      fileSystemHandle: FileSystemHandle,
    ): boolean;

    /** Queries the current permission state of the current handle. */
    queryPermission(fileSystemHandlePermissionDescriptor?: FileSystemHandlePermissionDescriptor): PermissionState;

    /** Requests read or readwrite permissions for the file handle. */
    requestPermission(fileSystemHandlePermissionDescriptor?: FileSystemHandlePermissionDescriptor): PermissionState;
  }

  export interface FileSystemFileHandle extends FileSystemHandle {
    /** Returns a Promise which resolves to a File object representing the state on disk of the entry represented by the handle. */
    getFile(): Promise<File>;

    /** Returns a Promise which resolves to a newly created FileSystemWritableFileStream object that can be used to write to a file. */
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  export interface FileSystemDirectoryHandle extends FileSystemHandle {
    /** Returns an Array of a given object's own enumerable property [key, value] pairs */
    entries(): [string, any][];

    /** Returns a FileSystemFileHandle for a file with the specified name, within the directory the method is called. */
    getFileHandle(
      /** A USVString representing the FileSystemHandle.name of the file you wish to retrieve. */
      name: string,

      /** An object with the following properties: */
      options?: {
        /** A Boolean. Default false. When set to true if the file is not found, one with the specified name will be created and returned. */
        create?: boolean;
      },
    ): Promise<FileSystemHandle>;

    /** Returns a FileSystemDirectoryHandle for a subdirectory with the specified name within the directory handle on which the method is called. */
    getDirectoryHandle(
      /** A USVString representing the FileSystemHandle.name of the file you wish to retrieve. */
      name: string,

      /** An object with the following properties: */
      options?: {
        /** A Boolean. Default false. When set to true if the file is not found, one with the specified name will be created and returned. */
        create?: boolean;
      },
    ): Promise<FileSystemDirectoryHandle>;

    /** Returns a new array iterator containing the keys for each item in FileSystemDirectoryHandle. */
    keys(): string[];

    /** Attempts to remove an entry if the directory handle contains a file or directory called the name specified. */
    removeEntry(
      /** A USVString representing the FileSystemHandle.name of the entry you wish to remove. */
      name: string,

      /** An optional object containing options, which are as follows: */
      options?: {
        /** A Boolean. Default false. When set to true entries will be removed recursively. */
        recursive?: boolean;
      },
    ): Promise<void>;

    /** Returns an Array of directory names from the parent handle to the specified child entry, with the name of the child entry as the last array item.
     *
     *
     * @returns A Promise which resolves with an Array of strings, or null if possibleDescendant is not a descendant of this FileSystemDirectoryHandle.
     */
    resolve(
      /** The FileSystemHandle.name of the FileSystemHandle from which to return the relative path. */
      possibleDescendant: string,
    ): string[] | null;

    /** Returns a new array iterator containing the values for each index in the FileSystemDirectoryHandle object. */
    values(): any[];
  }

  export interface FileSystemWritableFileStream<W = any> extends WritableStream<W> {
    close(): Promise<void>;

    /** Writes content into the file the method is called on, at the current file cursor offset. */
    write(
      /** Can be either the file data to write, in the form of a BufferSource, Blob or USVString. Or an object containing the following properties: */
      data:
        | BufferSource
        | Blob
        | string
        | {
            /** One of 'write', 'seek' or 'truncate'. This is required if the object is passed into the write() method. */
            type: 'write';
            /** The file data to write. Can be a BufferSource, Blob or USVString. This is required if the type is set to 'write'. */
            data: BufferSource | Blob | string;
            /** The byte position the current file cursor should move to if type 'seek' is used. Can also be set with 'write' in which case the write will start at the position. */
            position?: number;
            /** An unsigned long value representing the amount of bytes the stream should contain. This is required if the type is set to 'truncate' */
            size?: number;
          }
        | {
            /** One of 'write', 'seek' or 'truncate'. This is required if the object is passed into the write() method. */
            type: 'seek';
            /** The file data to write. Can be a BufferSource, Blob or USVString. This is required if the type is set to 'write'. */
            data?: BufferSource | Blob | string;
            /** The byte position the current file cursor should move to if type 'seek' is used. Can also be set with 'write' in which case the write will start at the position. */
            position: number;
            /** An unsigned long value representing the amount of bytes the stream should contain. This is required if the type is set to 'truncate' */
            size?: number;
          }
        | {
            /** One of 'write', 'seek' or 'truncate'. This is required if the object is passed into the write() method. */
            type: 'truncate';
            /** The file data to write. Can be a BufferSource, Blob or USVString. This is required if the type is set to 'write'. */
            data?: BufferSource | Blob | string;
            /** The byte position the current file cursor should move to if type 'seek' is used. Can also be set with 'write' in which case the write will start at the position. */
            position?: number;
            /** An unsigned long value representing the amount of bytes the stream should contain. This is required if the type is set to 'truncate' */
            size: number;
          },
    ): Promise<void>;

    /** Updates the current file cursor offset to the position (in bytes) specified. */
    seek(
      /** An unsigned long describing the byte position from the top (beginning) of the file. */
      position: number,
    ): Promise<void>;

    /** Updates the current file cursor offset to the position (in bytes) specified. */
    truncate(
      /** An unsigned long of the amount of bytes to resize the stream to. */
      size: number,
    ): Promise<void>;
  }
}
export {};
