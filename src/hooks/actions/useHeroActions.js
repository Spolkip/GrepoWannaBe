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
                const newHeroes = { ...cityData.heroes, [heroId]: { active: true } };

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
                if ((cityData.worship[cityData.god] || 0) < skill.cost) throw new Error("Not enough favor.");

                const newWorship = { ...cityData.worship, [cityData.god]: cityData.worship[cityData.god] - skill.cost };
                let newBuffs = { ...(cityData.buffs || {}) };

                if (skill.effect.type === 'troop_buff') {
                    newBuffs.battle = {
                        ...newBuffs.battle,
                        [skill.effect.subtype]: {
                            value: skill.effect.value,
                            unit_type: skill.effect.unit_type
                        }
                    };
                } else if (skill.effect.type === 'city_buff') {
                    newBuffs.city = {
                        ...newBuffs.city,
                        [skill.effect.subtype]: {
                            value: skill.effect.value,
                            expires: Date.now() + skill.effect.duration * 1000
                        }
                    };
                }

                transaction.update(cityDocRef, { worship: newWorship, buffs: newBuffs });
            });
            setMessage(`${skill.name} has been activated!`);
        } catch (error) {
            setMessage(`Failed to activate skill: ${error.message}`);
        }
    };

    return { onRecruitHero, onActivateSkill };
};
