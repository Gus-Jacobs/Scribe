import * as fs from 'fs';
import { marked } from 'marked';

export const processTextFile = (filePath: string): any[] => {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    // Map raw lines to Slate paragraphs
    return fileContent.split('\n').map(line => ({ 
        type: 'paragraph', 
        children: [{ text: line }] 
    }));
};

export const processMarkdownFile = (filePath: string): string => {
    const content = fs.readFileSync(filePath, 'utf-8');
    return marked(content) as string; // Output HTML
};

export const processHtmlFile = (filePath: string): string => {
    return fs.readFileSync(filePath, 'utf-8');
};