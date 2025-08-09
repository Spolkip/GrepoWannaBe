// src/hooks/useMapClickHandler.js
import { calculateDistance } from '../utils/travel';
import { getVillageTroops } from '../utils/combat';
import { useGame } from '../contexts/GameContext';
import { useCityState } from './useCityState'; // #comment Import useCityState to calculate points

/**
 * #comment Encapsulates click handling logic for map objects.
 */
export const useMapClickHandler = ({
    playerCity,
    currentUser,
    isPlacingDummyCity,
    handleCreateDummyCity,
    showCity,
    setTravelTimeInfo,
    openModal,
    closeModal,
    setMessage,
    conqueredVillages,
    conqueredRuins,
    playerAlliance,
    activeCityId // #comment Receive activeCityId to differentiate between active and inactive cities
}) => {
    const { playerCities, worldId } = useGame();
    const { calculateTotalPoints } = useCityState(worldId); // #comment Get the point calculation function

    const onCitySlotClick = (e, slotData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('village');
        if (isPlacingDummyCity && !slotData.ownerId) {
            handleCreateDummyCity(slotData.id, slotData);
            return;
        }

        if (slotData.ownerId === currentUser.uid) {
            // #comment The slotData from the map tile should have a unique ID which is the slotId.
            // We find the full city object from our playerCities context using this slotId.
            const city = Object.values(playerCities).find(c => c.slotId === slotData.id);

            if (city) {
                if (city.id === activeCityId) {
                    // #comment If the clicked city is the currently active one, go into city view.
                    showCity(city.id);
                } else {
                    // #comment If it's one of the player's other cities, open the inactive city modal.
                    const distance = calculateDistance(playerCity, city);
                    setTravelTimeInfo({ distance });
                    const cityDataForModal = { 
                        ...city, 
                        points: calculateTotalPoints(city) 
                    };
                    closeModal('city'); // #comment Ensure other modals are closed
                    openModal('ownInactiveCity', cityDataForModal);
                }
            } else {
                // #comment Enhanced debugging for the city lookup issue.
                console.error("City lookup failed. This is a data consistency issue.");
                console.log("Searching for slotId:", slotData.id);
                console.log("Available playerCities:", playerCities);
                const availableSlotIds = Object.values(playerCities).map(c => c.slotId);
                console.log("Available slotIds in playerCities context:", availableSlotIds);
                setMessage("Data for your city is out of sync. Please try refreshing the page.");
            }
        } else if (slotData.ownerId) {
            const distance = calculateDistance(playerCity, slotData);
            setTravelTimeInfo({ distance });
            const cityDataWithAlliance = { ...slotData, playerAlliance };
            openModal('city', cityDataWithAlliance);
        } else {
            setMessage('This plot is empty. Future updates will allow colonization!');
        }
    };
    
    const onVillageClick = (e, villageData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        if (playerCity.islandId !== villageData.islandId) {
            setMessage("You can only interact with villages on islands where you have a city.");
            return;
        }

        const isConqueredByPlayer = conqueredVillages && conqueredVillages[villageData.id];

        if (isConqueredByPlayer) {
            openModal('village', { ...villageData, ...conqueredVillages[villageData.id] });
        } else {
            const distance = calculateDistance(playerCity, villageData);
            setTravelTimeInfo({ distance });
            const targetData = {
                id: villageData.id,
                name: villageData.name,
                cityName: villageData.name,
                ownerId: null,
                ownerUsername: 'Neutral',
                x: villageData.x,
                y: villageData.y,
                islandId: villageData.islandId,
                isVillageTarget: true,
                troops: getVillageTroops(villageData),
                level: villageData.level || 1,
                demands: villageData.demands,
                supplies: villageData.supplies,
                tradeRatio: villageData.tradeRatio
            };
            openModal('city', targetData);
        }
    };

    const onRuinClick = (e, ruinData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        closeModal('village');
        const distance = calculateDistance(playerCity, ruinData);
        setTravelTimeInfo({ distance });

        const isConqueredByYou = conqueredRuins && conqueredRuins[ruinData.id];

        const targetData = {
            id: ruinData.id,
            name: ruinData.name,
            cityName: ruinData.name,
            ownerId: ruinData.ownerId || 'ruins',
            ownerUsername: ruinData.ownerUsername || 'Ancient Guardians',
            x: ruinData.x,
            y: ruinData.y,
            isRuinTarget: true,
            troops: ruinData.troops,
            researchReward: ruinData.researchReward,
            isConqueredByYou: !!isConqueredByYou
        };
        openModal('city', targetData);
    };

    return { onCitySlotClick, onVillageClick, onRuinClick };
};
