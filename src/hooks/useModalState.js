// src/hooks/useModalState.js
import { useState } from 'react';

export const useModalState = () => {
    const [modalState, setModalState] = useState({
        selectedCity: null,
        selectedVillage: null,
        actionDetails: null,
        isMovementsPanelOpen: false,
        isReportsPanelOpen: false,
        isAllianceModalOpen: false,
        isAllianceCreationOpen: false,
        isMessagesPanelOpen: false,
        isDivinePowersOpen: false,
        divinePowersTarget: null,
        isProfileModalOpen: false,
        isAllianceForumOpen: false, // #comment Add forum modal state
    });

    const openModal = (type, data) => {
        setModalState(prevState => {
            switch (type) {
                case 'city': return { ...prevState, selectedCity: data };
                case 'village': return { ...prevState, selectedVillage: data };
                case 'action': return { ...prevState, actionDetails: data };
                case 'movements': return { ...prevState, isMovementsPanelOpen: true };
                case 'reports': return { ...prevState, isReportsPanelOpen: true };
                case 'alliance': return { ...prevState, isAllianceModalOpen: true };
                case 'allianceCreation': return { ...prevState, isAllianceCreationOpen: true };
                case 'messages': return { ...prevState, isMessagesPanelOpen: true };
                case 'divinePowers': return { ...prevState, isDivinePowersOpen: true, divinePowersTarget: data?.targetCity || null };
                case 'profile': return { ...prevState, isProfileModalOpen: true };
                case 'allianceForum': return { ...prevState, isAllianceForumOpen: true }; // #comment Add forum modal open case
                default: return prevState;
            }
        });
    };

    const closeModal = (type) => {
        setModalState(prevState => {
            switch (type) {
                case 'city': return { ...prevState, selectedCity: null };
                case 'village': return { ...prevState, selectedVillage: null };
                case 'action': return { ...prevState, actionDetails: null };
                case 'movements': return { ...prevState, isMovementsPanelOpen: false };
                case 'reports': return { ...prevState, isReportsPanelOpen: false };
                case 'alliance': return { ...prevState, isAllianceModalOpen: false };
                case 'allianceCreation': return { ...prevState, isAllianceCreationOpen: false };
                case 'messages': return { ...prevState, isMessagesPanelOpen: false };
                case 'divinePowers': return { ...prevState, isDivinePowersOpen: false, divinePowersTarget: null };
                case 'profile': return { ...prevState, isProfileModalOpen: false };
                case 'allianceForum': return { ...prevState, isAllianceForumOpen: false }; // #comment Add forum modal close case
                default: return prevState;
            }
        });
    };

    return {
        modalState,
        openModal,
        closeModal,
    };
};
