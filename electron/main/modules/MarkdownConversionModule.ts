enum textFormat {
    normal = 0,
    bold = 1,
    italic = 2
}

enum headingLevel {
    h1 = "h1",
    h2 = "h2",
    h3 = "h3",
    h4 = "h4",
    h5 = "h5",
    h6 = "h6"
}

interface Node {
    children?: Node[];
    direction?: 'ltr' | 'rtl';
    format: string | number;
    indent?: number;
    type: string;
    version: number;
}

class RootNodeV1 implements Node {
    children: Node[];
    direction: 'ltr' | 'rtl';
    format: string;
    indent: number;
    type: string;
    version: number;

    constructor() {
        this.children = [];
        this.direction = 'ltr';
        this.format = '';
        this.indent = 0;
        this.type = 'root';
        this.version = 1;
    }
}

class ParagraphNodeV1 implements Node {
    children: Node[];
    direction: 'ltr' | 'rtl';
    format: string;
    indent: number;
    type: string;
    version: number;

    constructor() {
        this.children = [];
        this.direction = 'ltr';
        this.format = '';
        this.indent = 0;
        this.type = 'paragraph';
        this.version = 1;
    }
}

class TextNodeV1 implements Node {
    detail: number;
    format: textFormat;
    mode: string;
    style: string;
    text: string;
    type: string;
    version: number;

    constructor(text: string, format: textFormat = textFormat.normal) {
        this.detail = 0;
        this.format = format;
        this.mode = 'normal';
        this.style = '';
        this.text = text;
        this.type = 'text';
        this.version = 1;
    }
}

class HeadingNodeV1 implements Node {
    children: Node[];
    direction: 'ltr' | 'rtl';
    format: string;
    indent: number;
    tag: headingLevel;
    type: string;
    version: number;

    constructor(tag: headingLevel) {
        this.children = [];
        this.direction = 'ltr';
        this.format = '';
        this.indent = 0;
        this.tag = tag;
        this.type = 'heading';
        this.version = 1;
    }
}

/**
 * create text nodes, separated by bold, italic and normal text
 * @param text the text to be processed
 * @returns the created text nodes
 */
function proceedText(text: string): Array<TextNodeV1> {
    let textParts = text.split(' ');
    let currentText = '';
    let currentFormat = textFormat.normal;

    let textNodes: Array<TextNodeV1> = [];

    for (let i = 0; i < textParts.length; i++) {
        let textPart = textParts[i];
        let format = textFormat.normal;

        if (textPart.startsWith('**') && textPart.endsWith('**')) {
            format = textFormat.bold;
            textPart = textPart.substring(2, textPart.length - 2);
        } else if (textPart.startsWith('*') && textPart.endsWith('*')) {
            format = textFormat.italic;
            textPart = textPart.substring(1, textPart.length - 1);
        }

        currentText += ' '

        if (format === currentFormat) {
            currentText += textPart;
        } else {
            if (currentText !== '') {
                textNodes.push(new TextNodeV1(currentText, currentFormat));
            }
            currentText = textPart;
            currentFormat = format;
        }
    }

    if (currentText !== '') {
        textNodes.push(new TextNodeV1(currentText, currentFormat));
    }
    return textNodes;
}

/**
 * create a heading node
 * @param text the text to be processed
 * @returns the created heading node
 */

function proceedHeading(text: string): HeadingNodeV1 {
    let tag = null;
    if (text.startsWith('#')) {
        tag = headingLevel.h1;
    } else if (text.startsWith('##')) {
        tag = headingLevel.h2;
    } else if (text.startsWith('###')) {
        tag = headingLevel.h3;
    } else if (text.startsWith('####')) {
        tag = headingLevel.h4;
    } else if (text.startsWith('#####')) {
        tag = headingLevel.h5;
    } else if (text.startsWith('######')) {
        tag = headingLevel.h6;
    }
    else {
        return null;
    }

    let heading = new HeadingNodeV1(tag);
    let textNodes = proceedText(text.substring(tag.length + 1));
    heading.children = textNodes;
    return heading;
}


export function convertMarkdownToJSON(markdown: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const parts = markdown.split('\n');
        let jsonObject: any = { root: new RootNodeV1() }
        let currentParagraph: Node = new ParagraphNodeV1();

        for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            console.log(part);
            if (part === '') {
                if (currentParagraph) {
                    jsonObject.root.children.push(currentParagraph);
                    currentParagraph = null;
                }
            } else {
                let nodeCreated = false;

                if (part.startsWith('#')) {
                    let heading = proceedHeading(part);
                    if (heading) {
                        if (currentParagraph) {
                            jsonObject.root.children.push(currentParagraph);
                            currentParagraph = null;
                        }

                        jsonObject.root.children.push(heading);
                        nodeCreated = true;
                    }
                }

                if (!nodeCreated) {
                    let textNode = proceedText(part);
                    if (textNode) {
                        if (!currentParagraph) {
                            currentParagraph = new ParagraphNodeV1();
                        }
                        currentParagraph.children = currentParagraph.children.concat(textNode);
                    }
                }
            }
        }

        resolve(JSON.stringify(jsonObject));
    });
}