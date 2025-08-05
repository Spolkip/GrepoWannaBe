// src/components/QuestsButton.js
import React from 'react';
import './QuestsButton.css';
import questScroll from '../images/quests/quest_scroll.png';

// #comment A floating button to open the Quests modal
const QuestsButton = ({ onOpenQuests, hasUnclaimedQuests }) => {
    return (
        <div className="quests-button-container">
            <button 
                onClick={onOpenQuests} 
                className={`quests-button ${hasUnclaimedQuests ? 'glowing-border' : ''}`}
                title="Open Quests"
            >
                <img src={questScroll} alt="Quests" className="quests-icon" />
            </button>
            {hasUnclaimedQuests && (
                <span className="quests-notification-badge">
                    !
                </span>
            )}
        </div>
    );
};

export default QuestsButton;
