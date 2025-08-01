import React, { useRef } from 'react';
import './TextEditor.css';

// A simple text editor with BBCode formatting buttons
const TextEditor = ({ value, onChange }) => {
    const textareaRef = useRef(null);

    // #comment handles inserting BBCode tags around selected text
    const applyFormat = (tag, param = null) => {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        
        let newText;
        let openTag;

        if (param) {
            openTag = `[${tag}=${param}]`;
        } else {
            openTag = `[${tag}]`;
        }
        const closeTag = `[/${tag}]`;

        newText = `${value.substring(0, start)}${openTag}${selectedText}${closeTag}${value.substring(end)}`;
        
        onChange(newText);

        // #comment re-focus the textarea and place cursor after the inserted tag
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + openTag.length + selectedText.length + closeTag.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="text-editor-container">
            <div className="editor-toolbar">
                <button type="button" onClick={() => applyFormat('b')} className="toolbar-btn" title="Bold">B</button>
                <button type="button" onClick={() => applyFormat('i')} className="toolbar-btn italic" title="Italic">I</button>
                <button type="button" onClick={() => applyFormat('u')} className="toolbar-btn underline" title="Underline">U</button>
                <button type="button" onClick={() => applyFormat('color', 'red')} className="toolbar-btn color-red" title="Red Text">A</button>
                <button type="button" onClick={() => applyFormat('color', 'green')} className="toolbar-btn color-green" title="Green Text">A</button>
                <button type="button" onClick={() => applyFormat('quote')} className="toolbar-btn" title="Quote">"</button>
                <button type="button" onClick={() => applyFormat('player')} className="toolbar-btn" title="Player Name">P</button>
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="editor-textarea"
            />
        </div>
    );
};

export default TextEditor;
