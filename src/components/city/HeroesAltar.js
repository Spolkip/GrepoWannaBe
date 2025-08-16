// src/components/city/HeroesAltar.js
import React, { useState } from 'react';
import heroesConfig from '../../gameData/heroes.json';
import './HeroesAltar.css';
import { useGame } from '../../contexts/GameContext';

const heroImages = {};
const heroImageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
heroImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    heroImages[key] = heroImageContext(item);
});

const skillImages = {};
const skillImageContext = require.context('../../images/skills', false, /\.(png|jpe?g|svg)$/);
skillImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    skillImages[key] = skillImageContext(item);
});

const HeroesAltar = ({ cityGameState, onRecruitHero, onActivateSkill, onClose, onAssignHero, onUnassignHero }) => {
    const [selectedHeroId, setSelectedHeroId] = useState(Object.keys(heroesConfig)[0]);
    const { heroes = {} } = cityGameState;
    const { activeCityId } = useGame();

    // #comment Handles recruiting a hero, stopping the event from bubbling up.
    const handleRecruit = (e, heroId) => {
        e.stopPropagation();
        onRecruitHero(heroId);
    };

    // #comment Handles activating a hero's skill, stopping the event from bubbling up.
    const handleSkillActivation = (e, heroId, skill) => {
        e.stopPropagation();
        onActivateSkill(heroId, skill);
    };

    const handleAssign = (e, heroId) => {
        e.stopPropagation();
        onAssignHero(heroId);
    };

    const handleUnassign = (e, heroId) => {
        e.stopPropagation();
        onUnassignHero(heroId);
    };

    const selectedHero = heroesConfig[selectedHeroId];
    const isHeroInThisCity = heroes[selectedHeroId]?.cityId === activeCityId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="heroes-altar-container" onClick={e => e.stopPropagation()}>
                <div className="heroes-altar-header">
                    <h3>Heroes Altar</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="heroes-altar-content">
                    <div className="heroes-list">
                        {Object.entries(heroesConfig).map(([id, hero]) => (
                            <div key={id} className={`hero-list-item ${selectedHeroId === id ? 'selected' : ''}`} onClick={() => setSelectedHeroId(id)}>
                                <img src={heroImages[hero.image]} alt={hero.name} className="hero-list-avatar" />
                                <span>{hero.name}</span>
                                {heroes[id] && <span className="recruited-indicator">✔</span>}
                            </div>
                        ))}
                    </div>
                    <div className="hero-details-panel">
                        {selectedHero ? (
                            <div className="hero-details-content">
                                <div className="hero-main-info">
                                    <img src={heroImages[selectedHero.image]} alt={selectedHero.name} className="hero-details-avatar" />
                                    <div className="hero-text">
                                        <h4>{selectedHero.name}</h4>
                                        <p>{selectedHero.description}</p>
                                        {isHeroInThisCity && selectedHero.passive && (
                                            <div className="passive-skill-info">
                                                <h5>Passive: {selectedHero.passive.name}</h5>
                                                <p>{selectedHero.passive.description}</p>
                                            </div>
                                        )}
                                        {!heroes[selectedHeroId] && (
                                            <button className="recruit-btn" onClick={(e) => handleRecruit(e, selectedHeroId)}>
                                                Recruit ({selectedHero.cost.silver} Silver, {selectedHero.cost.favor} Favor)
                                            </button>
                                        )}
                                        {heroes[selectedHeroId] && !isHeroInThisCity && (
                                            <button className="recruit-btn" onClick={(e) => handleAssign(e, selectedHeroId)}>
                                                Assign to this City
                                            </button>
                                        )}
                                        {heroes[selectedHeroId] && isHeroInThisCity && (
                                            <button className="recruit-btn" onClick={(e) => handleUnassign(e, selectedHeroId)}>
                                                Unassign from City
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="skills-list">
                                    {selectedHero.skills.map(skill => (
                                        <div key={skill.name} className="skill-card">
                                            <img src={skillImages[skill.icon]} alt={skill.name} className="skill-icon" />
                                            <div className="skill-info">
                                                <h5>{skill.name} <span className="skill-type">({skill.type})</span></h5>
                                                <p>{skill.description}</p>
                                            </div>
                                            {heroes[selectedHeroId] && (
                                                <button className="activate-skill-btn" onClick={(e) => handleSkillActivation(e, selectedHeroId, skill)}>
                                                    Activate ({skill.cost} Favor)
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p>Select a hero to see details.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeroesAltar;
