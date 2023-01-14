import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useState, useEffect, useCallback } from "react";

import {
    HeadingTagType,
    $createHeadingNode
} from '@lexical/rich-text';

import {
    $setBlocksType_experimental,
} from '@lexical/selection';

import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    REMOVE_LIST_COMMAND,
  } from '@lexical/list';

import {
    $getSelection,
    NodeSelection,
    RangeSelection,
    GridSelection,
    FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND,
    $isRangeSelection,
    DEPRECATED_$isGridSelection,
    $createParagraphNode
} from "lexical";
import { mergeRegister } from "@lexical/utils";

import styles from "styles/editor.toolbar.module.scss";
import Dropdown from "../generic/Dropdown";

const LowPriority = 1;

const dropdownTextFormatItems = [
    {
        title: 'Normal',
        selected: false,
        key: 'normal'
    },
    {
        title: 'Heading 1',
        selected: false,
        key: 'heading-1'
    },
    {
        title: 'Heading 2',
        selected: false,
        key: 'heading-2'
    },
    {
        title: 'Heading 3',
        selected: false,
        key: 'heading-3'
    },
    {
        title: 'Heading 4',
        selected: false,
        key: 'heading-4'
    },
    {
        title: 'Heading 5',
        selected: false,
        key: 'heading-5'
    },
    {
        title: 'Heading 6',
        selected: false,
        key: 'heading-6'
    },
    {
        title: 'Bullet List',
        selected: false,
        key: 'bullet-list'
    },
    {
        title: 'Numbered List',
        selected: false,
        key: 'numbered-list'
    },
    {
        title: 'Quote',
        selected: false,
        key: 'quote'
    },
    {
        title: 'Code',
        selected: false,
        key: 'code'
    },
]

export default function Toolbar() {
    const [editor] = useLexicalComposerContext();

    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);

    const currTextFormat = 'normal';

    const updateToolbar = useCallback(() => {
        const selection: null | RangeSelection | NodeSelection | GridSelection = $getSelection();

        const temp: RangeSelection = selection as RangeSelection;

        if (temp) {
            setIsBold(temp.hasFormat("bold"));
            setIsItalic(temp.hasFormat("italic"));
            setIsUnderline(temp.hasFormat("underline"));
        }
    }, [editor]);

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateToolbar();
                });
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                (_payload, newEditor) => {
                    updateToolbar();
                    return false;
                },
                LowPriority
            )
        );
    }, [editor, updateToolbar]);

    const formatParagraph = () => {
        editor.update(() => {
            const selection = $getSelection();
            if (
                $isRangeSelection(selection) ||
                DEPRECATED_$isGridSelection(selection)
            )
                $setBlocksType_experimental(selection, () => $createParagraphNode());
        });
    };

    const formatHeading = (headingSize: HeadingTagType) => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) || DEPRECATED_$isGridSelection(selection)) {
                $setBlocksType_experimental(selection, () => $createHeadingNode(headingSize));
            }
        })
    }

    function handleDropdownTextFormatItemCLick(item: any) {
        if (item.key === currTextFormat) {
            if (item.key === 'bullet-list' || item.key === 'numbered-list') {
                editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
            }
            return;
        }

        switch (item.key) {
            case 'normal':
                formatParagraph();
                break;
            case 'heading-1':
                formatHeading('h1');
                break;
            case 'heading-2':
                formatHeading('h2');
                break;
            case 'heading-3':
                formatHeading('h3');
                break;
            case 'heading-4':
                formatHeading('h4');
                break;
            case 'heading-5':
                formatHeading('h5');
                break;
            case 'heading-6':
                formatHeading('h6');
                break;
            case 'bullet-list':
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
                break;
            case 'numbered-list':
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
                break;
        }
    }

    return (
        <div className={styles.editorToolbar}>
            <div className={styles.toolbarItem + " " + styles.spaced}>
                <p>Text Format</p>
                <Dropdown items={dropdownTextFormatItems} onItemSelect={handleDropdownTextFormatItemCLick} hidden={false} />
            </div>
            <button onClick={() => { editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"); }}
                className={styles.toolbarItem + " " + styles.spaced + " " + (isBold ? styles.active : "")}
                aria-label="Format Bold">B
            </button>

            <button onClick={() => { editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"); }}
                className={styles.toolbarItem + " " + styles.spaced + " " + (isItalic ? styles.active : "")}
                aria-label="Format Italics">I
            </button>

            <button onClick={() => { editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"); }}
                className={styles.toolbarItem + " " + styles.spaced + " " + (isUnderline ? styles.active : "")}
                aria-label="Format Underline">U
            </button>
        </div>
    )
}
