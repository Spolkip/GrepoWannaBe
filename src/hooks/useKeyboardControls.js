// src/hooks/useKeyboardControls.js
import { useEffect } from 'react';

/**
 * #comment A custom hook to handle global keyboard shortcuts for game navigation.
 */
export const useKeyboardControls = (controls) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // #comment Ignore key presses if the user is typing in an input, textarea, or text editor
            const activeElement = document.activeElement;
            const isTyping = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;
            if (isTyping) return;

            switch (e.key.toLowerCase()) {
                case 'm':
                    controls.toggleView?.();
                    break;
                case 'a':
                    controls.openAlliance?.();
                    break;
                case 'q':
                    controls.openQuests?.();
                    break;
                case ' ': // Space bar
                    e.preventDefault(); // Prevent default space bar action (e.g., scrolling)
                    controls.centerOnCity?.();
                    break;
                case 'f':
                    controls.openForum?.();
                    break;
                case 'i': // Using 'i' for messages/inbox
                    controls.openMessages?.();
                    break;
                case 'l':
                    controls.openLeaderboard?.();
                    break;
                case 'p':
                    controls.openProfile?.();
                    break;
                case 's':
                    controls.openSettings?.();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // #comment Cleanup function to remove the event listener
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [controls]); // #comment Re-run the effect if the controls object changes
};
