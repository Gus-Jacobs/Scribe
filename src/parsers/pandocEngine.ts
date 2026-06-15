import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Pandoc is smart enough to auto-detect DOCX, ODT, EPUB, RTF, and LaTeX from the file extension.
export const processWithPandoc = async (filePath: string): Promise<string> => {
    try {
        // -t html5 tells Pandoc to output clean, semantic HTML that your Slate UI loves
        const { stdout } = await execPromise(`pandoc "${filePath}" -t html5`);
        return stdout;
    } catch (error) {
        console.error("Pandoc Error:", error);
        throw new Error("Pandoc engine failed. Ensure Pandoc is installed on your system.");
    }
};