import { useState } from 'react';

export const useModalState = () => {
    const [modalState, setModalState] = useState({
        selectedCity: null,
        selectedVillage: null,
        actionDetails: null,
        isMovementsPanelOpen: false,
        isReportsPanelOpen: false,
        isAllianceModalOpen: false,
        isMessagesPanelOpen: false,
        isDivinePowersOpen: false,
        divinePowersTarget: null, // To store target city for spells
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
                case 'messages': return { ...prevState, isMessagesPanelOpen: true };
                case 'divinePowers': return { ...prevState, isDivinePowersOpen: true, divinePowersTarget: data?.targetCity || null };
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
                case 'messages': return { ...prevState, isMessagesPanelOpen: false };
                case 'divinePowers': return { ...prevState, isDivinePowersOpen: false, divinePowersTarget: null };
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