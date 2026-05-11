/**
 * SQLite3 WASM and OPFS Engine.
 */
export class DbEngine {
    constructor() {
        this.sqlite3 = null;
        this.db = null;
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
     * Imports a remote file into the Origin Private File System (OPFS).
     * @param {string} url - Remote URL.
     * @param {string} filename - Local filename in OPFS.
     */
    async importToOpfs(url, filename) {
        console.log(`Importing ${url} to OPFS as ${filename}...`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        
        const buffer = await response.arrayBuffer();
        
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(buffer);
        await writable.close();
        console.log(`Successfully imported ${filename} to OPFS.`);
    }

    /**
     * Opens a database stored in OPFS.
     * @param {string} filename - The filename in OPFS.
     */
    async openOpfsDb(filename) {
        await this.init();
        
        if (!this.sqlite3.oo1.OpfsDb) {
            throw new Error('OPFS is not supported or not enabled in this SQLite build.');
        }

        try {
            this.db = new this.sqlite3.oo1.OpfsDb(filename);
            console.log(`Database ${filename} opened via OPFS.`);
        } catch (err) {
            console.error(`Failed to open OPFS database ${filename}:`, err);
            throw err;
        }
    }

    /**
     * Executes a SQL query and returns rows as objects.
     */
    query(sql, params = []) {
        if (!this.db) throw new Error('Database not open');
        return this.db.selectObjects(sql, params);
    }

    /**
     * Executes a SQL query and returns a single blob.
     */
    getBlob(sql, params = []) {
        if (!this.db) throw new Error('Database not open');
        const rows = this.db.selectArrays(sql, params);
        return rows.length > 0 ? rows[0][0] : null;
    }
}
