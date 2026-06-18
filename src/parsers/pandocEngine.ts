import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Pandoc auto-detects DOCX, ODT, EPUB, RTF, and LaTeX from the file extension.
export const processWithPandoc = async (filePath: string): Promise<string> => {
    // --embed-resources inlines images (and other media) as base64 data URIs so
    // they survive the import into Slate. It implies --standalone, which also
    // gives us a complete document the renderer's DOMParser can read reliably.
    const withMedia = `pandoc "${filePath}" -t html5 --embed-resources --standalone`;
    const plain = `pandoc "${filePath}" -t html5`;
    try {
        const { stdout } = await execPromise(withMedia);
        return stdout;
    } catch (embedError) {
        // Older Pandoc builds (<2.19) lack --embed-resources; fall back to a
        // plain conversion so the document still opens (text/structure intact).
        console.warn('Pandoc --embed-resources unavailable, retrying without it:', embedError);
        try {
            const { stdout } = await execPromise(plain);
            return stdout;
        } catch (error) {
            console.error('Pandoc Error:', error);
            throw new Error('Pandoc engine failed. Ensure Pandoc is installed on your system.');
        }
    }
};