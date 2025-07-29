import { useState } from 'react';

export const useModalState = () => {
    const [selectedCity, setSelectedCity] = useState(null);
    const [selectedVillage, setSelectedVillage] = useState(null);
    const [actionDetails, setActionDetails] = useState(null);
    const [isMovementsPanelOpen, setIsMovementsPanelOpen] = useState(false);
    const [isReportsPanelOpen, setIsReportsPanelOpen] = useState(false);

    const openModal = (type, data) => {
        switch (type) {
            case 'city':
                setSelectedCity(data);
                break;
            case 'village':
                setSelectedVillage(data);
                break;
            case 'action':
                setActionDetails(data);
                break;
            case 'movements':
                setIsMovementsPanelOpen(true);
                break;
            case 'reports':
                setIsReportsPanelOpen(true);
                break;
            default:
                break;
        }
    };

    const closeModal = (type) => {
        switch (type) {
            case 'city':
                setSelectedCity(null);
                break;
            case 'village':
                setSelectedVillage(null);
                break;
            case 'action':
                setActionDetails(null);
                break;
            case 'movements':
                setIsMovementsPanelOpen(false);
                break;
            case 'reports':
                setIsReportsPanelOpen(false);
                break;
            default:
                break;
        }
    };

    return {
        selectedCity,
        selectedVillage,
        actionDetails,
        isMovementsPanelOpen,
        isReportsPanelOpen,
        openModal,
        closeModal,
    };
};