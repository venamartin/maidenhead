/**
 * SQLite3 WASM Engine with OPFS and Memory Fallback.
 */
export class DbEngine {
    constructor() {
        this.dbName = 'Maidenhead_Cm96_Openstreetmap.htrx';
        this.dbPath = `./maps/${this.dbName}`;
        this.db = null;
        this.sqlite3 = null;
    }

    /**
     * Initialize the SQLite3 WASM module.
     */
    async init() {
        if (this.sqlite3) return;

        try {
            this.sqlite3 = await globalThis.sqlite3InitModule({
                locateFile: (file) => {
                    return `js/lib/${file}`;
                },
                print: console.log,
                printErr: console.error,
            });
            console.log('SQLite3 WASM initialized. Version:', this.sqlite3.version.libVersion);
        } catch (err) {
            console.error('Failed to initialize SQLite3 WASM:', err);
            throw err;
        }
    }

    /**
     * Imports a remote file and opens it. Uses OPFS if available, otherwise falls back to Memory.
     * @param {string} url - Remote URL.
     * @param {string} filename - Local filename for OPFS.
     * @param {function} onProgress - Callback for progress (0-1).
     */
    async loadDb(url, filename, onProgress) {
        await this.init();

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

        const contentLength = +response.headers.get('Content-Length');
        const reader = response.body.getReader();
        let receivedLength = 0; 
        let chunks = []; 

        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            if (contentLength && onProgress) {
                onProgress(receivedLength / contentLength, receivedLength, contentLength);
            }
        }

        const uint8Array = new Uint8Array(receivedLength);
        let position = 0;
        for(let chunk of chunks) {
            uint8Array.set(chunk, position);
            position += chunk.length;
        }

        if (uint8Array.byteLength < 1000) {
             const text = new TextDecoder().decode(uint8Array);
             if (text.includes('version https://git-lfs.github.com/spec/v1')) {
                 throw new Error("LFS Pointer Detected! Use 'git lfs pull' or check your download URL.");
             }
        }

        // 1. Try to use OPFS for persistence
        if (this.sqlite3.oo1.OpfsDb) {
            try {
                console.log("Saving database to OPFS...");
                const root = await navigator.storage.getDirectory();
                const fileHandle = await root.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(uint8Array);
                await writable.close();

                this.db = new this.sqlite3.oo1.OpfsDb(filename);
                console.log(`Database ${filename} opened via OPFS.`);
                return;
            } catch (err) {
                console.warn("OPFS failed, falling back to Memory mode:", err);
            }
        }

        // 2. Fallback: Load directly into memory
        try {
            this.db = new this.sqlite3.oo1.DB();
            const p = this.sqlite3.wasm.allocFromTypedArray(uint8Array);
            const rc = this.sqlite3.capi.sqlite3_deserialize(
                this.db.pointer, 'main', p, uint8Array.byteLength, uint8Array.byteLength, 
                this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | this.sqlite3.capi.SQLITE_DESERIALIZE_READONLY
            );
            
            if (rc !== 0) throw new Error("SQLite deserialize failed with code " + rc);
            console.log("Database loaded into Memory successfully.");
        } catch (err) {
            console.error("Memory fallback failed:", err);
            throw err;
        }
    }

    /**
     * Executes a SQL query and returns rows as arrays.
     */
    async selectArrays(sql, params = []) {
        if (!this.db) throw new Error('Database not open');
        // Using async to match the Leaflet layer's expectation
        return this.db.selectArrays(sql, params);
    }
}
