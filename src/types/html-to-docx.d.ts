declare module '@turbodocx/html-to-docx' {
  /**
   * Converts an HTML string into a DOCX file (ArrayBuffer or Buffer depending
   * on environment). Maintained fork of html-to-docx with correct handling of
   * em/del/s tags and nested inline formatting.
   * Options: https://github.com/TurboDocx/html-to-docx
   */
  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    options?: Record<string, unknown>,
    footerHTMLString?: string | null
  ): Promise<ArrayBuffer | Buffer>;
  export default HTMLtoDOCX;
}
