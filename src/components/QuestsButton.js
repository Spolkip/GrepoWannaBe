// src/components/QuestsButton.js
import React, { useMemo } from 'react';
import './QuestsButton.css';
import questSpritesheet from '../images/quests/quest_spritesheet.png'; // Assuming you named the new spritesheet this

// A floating button to open the Quests modal
const QuestsButton = ({ quests = [], onOpenQuests }) => {

    // #comment Derive quest states from the quests array
    const hasUnclaimedQuests = useMemo(() => {
        return quests.some(q => q.isComplete && !q.isClaimed);
    }, [quests]);

    const allQuestsClaimed = useMemo(() => {
        // This checks if all quests have been claimed, but only if there are quests to begin with.
        return quests.length > 0 && quests.every(q => q.isClaimed);
    }, [quests]);
    
    // #comment Determine the visual state of the button
    const buttonState = useMemo(() => {
        // If there is an unclaimed quest, show the alert icon.
        if (hasUnclaimedQuests) {
            return 'unclaimed';
        }
        // If all quests have been completed and claimed, show the trophy.
        if (allQuestsClaimed) {
            return 'completed';
        }
        // Otherwise, show the scroll icon. This covers the case where there are quests to do, or no quests at all.
        return 'idle';
    }, [hasUnclaimedQuests, allQuestsClaimed]);

    const buttonStyle = {
        backgroundImage: `url(${questSpritesheet})`,
        backgroundSize: '300% 100%',
    };

    return (
        <div className="quests-button-container">
            <button 
                onClick={onOpenQuests} 
                className={`quests-button ${buttonState}`}
                title="Open Quests"
                style={buttonStyle}
            >
            </button>
        </div>
    );
};

export default QuestsButton;
