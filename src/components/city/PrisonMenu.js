// src/components/city/PrisonMenu.js
import React from 'react';
import heroesConfig from '../../gameData/heroes.json';
import Countdown from '../map/Countdown';
import './PrisonMenu.css';

const heroImages = {};
const heroImageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
heroImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    heroImages[key] = heroImageContext(item);
});

const PrisonMenu = ({ cityGameState, onClose }) => {
    const prisoners = cityGameState.prisoners || [];
    const prisonLevel = cityGameState.buildings.prison?.level || 0;
    // #comment Capacity starts at 5 and increases by 1 per level, up to 29 at max level 25.
    const capacity = prisonLevel > 0 ? prisonLevel + 4 : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="prison-menu-container" onClick={e => e.stopPropagation()}>
                <div className="prison-header">
                    <h3>Prison (Level {prisonLevel})</h3>
                    <p>Capacity: {prisoners.length} / {capacity}</p>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="prison-content">
                    {prisoners.length > 0 ? (
                        prisoners.map(prisoner => {
                            const hero = heroesConfig[prisoner.heroId];
                            if (!hero) return null;
                            // #comment Duration starts at 8 hours and increases up to 3 days at max level.
                            const durationSeconds = 28800 + (prisonLevel - 1) * 9600;
                            
                            // #comment Safely handle both Firestore Timestamp and JS Date objects
                            const capturedAtTime = prisoner.capturedAt?.toDate ? prisoner.capturedAt.toDate().getTime() : new Date(prisoner.capturedAt).getTime();
                            const executionTime = new Date(capturedAtTime + durationSeconds * 1000);

                            return (
                                <div key={prisoner.heroId} className="prisoner-item">
                                    <img src={heroImages[hero.image]} alt={hero.name} className="prisoner-avatar" />
                                    <div className="prisoner-info">
                                        <p className="prisoner-name">{hero.name}</p>
                                        <p className="prisoner-owner">Owner: {prisoner.ownerUsername}</p>
                                        <p className="execution-timer">
                                            Execution in: <Countdown arrivalTime={executionTime} />
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-gray-500">The prison is empty.</p>
                    )}
                </div>
                 <div className="prison-footer">
                    <p className="text-xs italic">Heroes are executed after their timer runs out. Executed heroes can only be revived with a 'Soulstone'. If this city is conquered, all prisoners will be freed.</p>
                </div>
            </div>
        </div>
    );
};

export default PrisonMenu;
