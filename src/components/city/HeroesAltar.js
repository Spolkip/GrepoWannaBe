// src/components/city/HeroesAltar.js
import React, { useState } from 'react';
import heroesConfig from '../../gameData/heroes.json';
import './HeroesAltar.css';

const HeroesAltar = ({ cityGameState, onRecruitHero, onActivateSkill, onClose }) => {
    const [selectedHeroId, setSelectedHeroId] = useState(null);
    const { heroes = {} } = cityGameState;

    const handleRecruit = (heroId) => {
        onRecruitHero(heroId);
    };

    const handleSkillActivation = (heroId, skill) => {
        onActivateSkill(heroId, skill);
    };

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
                            <div key={id} className={`hero-card ${selectedHeroId === id ? 'selected' : ''}`} onClick={() => setSelectedHeroId(id)}>
                                <img src={`/images/heroes/${hero.image}`} alt={hero.name} className="hero-avatar" />
                                <p>{hero.name}</p>
                                {!heroes[id] && (
                                    <button className="recruit-btn" onClick={() => handleRecruit(id)}>
                                        Recruit
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="hero-details">
                        {selectedHeroId && heroesConfig[selectedHeroId] ? (
                            <div>
                                <h4>{heroesConfig[selectedHeroId].name}</h4>
                                <p>{heroesConfig[selectedHeroId].description}</p>
                                <div className="skills-list">
                                    {heroesConfig[selectedHeroId].skills.map(skill => (
                                        <div key={skill.name} className="skill-card">
                                            <h5>{skill.name} ({skill.type})</h5>
                                            <p>{skill.description}</p>
                                            {heroes[selectedHeroId] && (
                                                <button className="activate-skill-btn" onClick={() => handleSkillActivation(selectedHeroId, skill)}>
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
