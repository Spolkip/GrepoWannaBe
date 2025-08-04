// src/components/quests/QuestsModal.js
import React from 'react';
import './Quests.css';

const QuestsModal = ({ quests, claimReward, onClose }) => {
    const activeQuests = quests.filter(q => !q.isClaimed);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="quest-modal-container" onClick={e => e.stopPropagation()}>
                <div className="quest-modal-header">
                    <h2>Quests</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="quest-modal-content">
                    {activeQuests.length > 0 ? activeQuests.map(quest => (
                        <div key={quest.id} className="quest-item">
                            <div>
                                <h3 className="quest-title">{quest.title}</h3>
                                <p className="quest-description">{quest.description}</p>
                                <div className="quest-rewards">
                                    <strong>Reward: </strong>
                                    {quest.rewards.resources && Object.entries(quest.rewards.resources).map(([res, amount]) => `${amount} ${res}`).join(', ')}
                                    {quest.rewards.units && Object.entries(quest.rewards.units).map(([unit, amount]) => `${amount} ${unit}`).join(', ')}
                                </div>
                            </div>
                            <button
                                onClick={() => claimReward(quest.id)}
                                disabled={!quest.isComplete}
                                className="quest-claim-btn"
                            >
                                {quest.isComplete ? 'Claim' : 'In Progress'}
                            </button>
                        </div>
                    )) : (
                        <p className="text-center">No active quests.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestsModal;
