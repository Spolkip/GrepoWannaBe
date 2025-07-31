// src/components/city/DivinePowers.js
import React from 'react';
import godsConfig from '../../gameData/gods.json';
import './DivinePowers.css';

const DivinePowers = ({ godName, playerReligion, favor, onCastSpell, onClose }) => {
    const getGodDetails = (name, religion) => {
        if (!name || !religion) return null;
        const religionKey = religion.toLowerCase();
        const pantheon = godsConfig[religionKey];
        if (!pantheon) return null;
        return Object.values(pantheon).find(g => g.name === name);
    };

    const godDetails = getGodDetails(godName, playerReligion);

    if (!godDetails) {
        return null;
    }

    return (
        <div className="divine-powers-modal-overlay" onClick={onClose}>
            <div className="divine-powers-modal-content" onClick={e => e.stopPropagation()}>
                <div className="divine-powers-header">
                    <h2>{godDetails.name}'s Powers</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="powers-grid">
                    {godDetails.powers.map(power => (
                        <div key={power.name} className="power-card">
                            <h3>{power.name}</h3>
                            <p>{power.description}</p>
                            <div className="power-cost">
                                Cost: {power.favorCost} Favor
                            </div>
                            <button
                                onClick={() => onCastSpell(power)}
                                disabled={favor < power.favorCost}
                                className="cast-spell-button"
                            >
                                Cast Spell
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DivinePowers;