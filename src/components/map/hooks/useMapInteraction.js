import { useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { calculateDistance } from '../../../utils/travel';

export const useMapInteraction = (playerCity, showCity, setMessage) => {
    const { currentUser } = useAuth();
    const [selectedCity, setSelectedCity] = useState(null);
    const [selectedVillage, setSelectedVillage] = useState(null);
    const [actionDetails, setActionDetails] = useState(null);
    const [travelTimeInfo, setTravelTimeInfo] = useState(null);

    const handleCitySlotClick = useCallback((slotData, isPlacingDummyCity, onPlaceDummyCity) => {
        setSelectedVillage(null);
        if (isPlacingDummyCity && !slotData.ownerId) {
            onPlaceDummyCity(slotData.id, slotData);
            return;
        }

        if (slotData.ownerId === currentUser.uid) {
            showCity();
        } else if (slotData.ownerId) {
            // FIX: The island check has been removed here to allow attacking cities on other islands.
            if (playerCity) {
                const distance = calculateDistance(playerCity, slotData);
                setTravelTimeInfo({ distance });
            }
            setSelectedCity(slotData);
        } else {
            setMessage('This plot is empty. Future updates will allow colonization!');
        }
    }, [currentUser, playerCity, showCity, setMessage]);

    const handleVillageClick = useCallback((villageData, getVillageTroops) => {
        setSelectedCity(null);
        // This check correctly remains, preventing interaction with villages on other islands.
        if (!playerCity || villageData.islandId !== playerCity.islandId) {
            setMessage("You can only interact with villages on your current island.");
            return;
        }

        if (villageData.ownerId === currentUser.uid) {
            setSelectedVillage(villageData);
        } else {
            const distance = calculateDistance(playerCity, villageData);
            setTravelTimeInfo({ distance });
            const targetData = {
                ...villageData,
                cityName: villageData.name,
                ownerUsername: villageData.ownerUsername || 'Neutral',
                isVillageTarget: true,
                troops: getVillageTroops(villageData),
            };
            setSelectedCity(targetData);
        }
    }, [currentUser, playerCity, setMessage]);

    const handleActionClick = useCallback((mode, target) => {
        if (['attack', 'reinforce', 'scout', 'trade'].includes(mode)) {
            setActionDetails({ mode, city: target });
            setSelectedCity(null);
            setSelectedVillage(null);
        } else {
            setMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} is not yet implemented.`);
        }
    }, [setMessage]);

    const closeAllModals = () => {
        setSelectedCity(null);
        setSelectedVillage(null);
        setActionDetails(null);
        setTravelTimeInfo(null);
    };

    return {
        selectedCity,
        selectedVillage,
        actionDetails,
        travelTimeInfo,
        handleCitySlotClick,
        handleVillageClick,
        handleActionClick,
        closeAllModals,
    };
};