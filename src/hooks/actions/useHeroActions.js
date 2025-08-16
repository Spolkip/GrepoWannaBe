// src/hooks/actions/useHeroActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction } from 'firebase/firestore';
import heroesConfig from '../../gameData/heroes.json';

export const useHeroActions = (cityGameState, saveGameState, setMessage) => {
    const { currentUser } = useAuth();
    const { worldId, activeCityId } = useGame();

    const onRecruitHero = async (heroId) => {
        const hero = heroesConfig[heroId];
        if (!hero) return;

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");

                const cityData = cityDoc.data();
                if (cityData.resources.silver < hero.cost.silver) throw new Error("Not enough silver.");
                if ((cityData.worship[cityData.god] || 0) < hero.cost.favor) throw new Error("Not enough favor.");

                const newResources = { ...cityData.resources, silver: cityData.resources.silver - hero.cost.silver };
                const newWorship = { ...cityData.worship, [cityData.god]: cityData.worship[cityData.god] - hero.cost.favor };
                const newHeroes = { ...cityData.heroes, [heroId]: { active: true, cityId: null, level: 1, xp: 0 } };

                transaction.update(cityDocRef, { resources: newResources, worship: newWorship, heroes: newHeroes });
            });
            setMessage(`${hero.name} has been recruited!`);
        } catch (error) {
            setMessage(`Failed to recruit hero: ${error.message}`);
        }
    };

    const onActivateSkill = async (heroId, skill) => {
        const hero = heroesConfig[heroId];
        if (!hero) return;

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");

                const cityData = cityDoc.data();
                const heroData = cityData.heroes?.[heroId] || { level: 1 };
                const currentSkillCost = (skill.cost.base || 0) + ((heroData.level - 1) * (skill.cost.perLevel || 0));

                // #comment Check for favor cost
                if ((cityData.worship?.[cityData.god] || 0) < currentSkillCost) {
                    throw new Error("Not enough favor.");
                }

                // #comment Check for skill cooldown
                const activeSkills = cityData.activeSkills || {};
                const now = Date.now();
                if (activeSkills[skill.name] && now < activeSkills[skill.name].expires) {
                    const timeLeft = Math.ceil((activeSkills[skill.name].expires - now) / 1000);
                    throw new Error(`Skill is on cooldown. Time left: ${timeLeft}s`);
                }

                // #comment Deduct favor
                const newWorship = { ...cityData.worship, [cityData.god]: cityData.worship[cityData.god] - currentSkillCost };

                // #comment Apply effect and set cooldown
                let newBuffs = { ...(cityData.buffs || {}) };
                const newActiveSkills = { ...activeSkills };

                const skillCooldown = (skill.cooldown || 0) * 1000;
                newActiveSkills[skill.name] = {
                    activatedAt: now,
                    expires: now + skillCooldown
                };

                const effectValue = (skill.effect.baseValue || 0) + ((heroData.level - 1) * (skill.effect.valuePerLevel || 0));

                if (skill.effect.type === 'troop_buff') {
                    newBuffs.battle = {
                        ...(newBuffs.battle || {}),
                        [skill.effect.subtype]: {
                            value: effectValue,
                            unit_type: skill.effect.unit_type
                        }
                    };
                } else if (skill.effect.type === 'city_buff') {
                    const skillDuration = (skill.effect.duration || 0) * 1000;
                    newBuffs.city = {
                        ...(newBuffs.city || {}),
                        [skill.effect.subtype]: {
                            value: effectValue,
                            expires: now + skillDuration
                        }
                    };
                }

                transaction.update(cityDocRef, {
                    worship: newWorship,
                    buffs: newBuffs,
                    activeSkills: newActiveSkills
                });
            });
            setMessage(`${skill.name} has been activated!`);
        } catch (error) {
            setMessage(`Failed to activate skill: ${error.message}`);
        }
    };

    const onAssignHero = async (heroId) => {
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");

                const cityData = cityDoc.data();
                const heroes = cityData.heroes || {};

                // #comment Check if another hero is already in this city
                for (const hId in heroes) {
                    if (heroes[hId].cityId === activeCityId) {
                        throw new Error("Another hero is already stationed in this city.");
                    }
                }
                
                const newHeroes = { ...heroes, [heroId]: { ...heroes[heroId], cityId: activeCityId } };
                transaction.update(cityDocRef, { heroes: newHeroes });
            });
            setMessage(`${heroesConfig[heroId].name} is now stationed in this city.`);
        } catch (error) {
            setMessage(`Failed to assign hero: ${error.message}`);
        }
    };

    const onUnassignHero = async (heroId) => {
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
                const cityData = cityDoc.data();
                const heroes = cityData.heroes || {};
                const newHeroes = { ...heroes, [heroId]: { ...heroes[heroId], cityId: null } };
                transaction.update(cityDocRef, { heroes: newHeroes });
            });
            setMessage(`${heroesConfig[heroId].name} is no longer stationed in this city.`);
        } catch (error) {
            setMessage(`Failed to unassign hero: ${error.message}`);
        }
    };

    return { onRecruitHero, onActivateSkill, onAssignHero, onUnassignHero };
};