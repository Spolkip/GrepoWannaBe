// src/components/CityView.js
import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './shared/Modal';
import CityModals from './city/CityModals';
import CityViewContent from './city/CityViewContent';
import DivinePowers from './city/DivinePowers';
import { useCityState } from '../hooks/useCityState';
import { useGame } from '../contexts/GameContext';
import { useCityModalManager } from '../hooks/useCityModalManager';
import { useCityActions } from '../hooks/useCityActions';
import SidebarNav from './map/SidebarNav';
import TopBar from './map/TopBar'; // Import the TopBar
import QuestsButton from './QuestsButton';

const CityView = ({ 
    showMap, 
    worldId,
    openModal,
    unreadReportsCount,
    unreadMessagesCount,
    isUnderAttack,
    incomingAttackCount,
    handleOpenAlliance,
    handleOpenProfile,
    // #comment Props passed down from Game.js
    movements,
    onCancelTrain,
    onCancelMovement,
    combinedSlots,
    onRenameCity,
    quests
}) => {
    const { currentUser, userProfile } = useAuth();
    const { gameSettings, worldState } = useGame(); // Get worldState here
    const [isInstantBuild, setIsInstantBuild] = useState(false);
    const [isInstantResearch, setIsInstantResearch] = useState(false);
    const [isInstantUnits, setIsInstantUnits] = useState(false);
    const [message, setMessage] = useState('');

    const {
        cityGameState, setCityGameState, getUpgradeCost, getFarmCapacity,
        calculateUsedPopulation, getProductionRates, getWarehouseCapacity,
        getHospitalCapacity, saveGameState, getResearchCost, calculateHappiness,
        getMaxWorkerSlots, getMarketCapacity,
    } = useCityState(worldId, isInstantBuild, isInstantResearch, isInstantUnits);

    const { modalState, openModal: openCityModal, closeModal, setModalState } = useCityModalManager();

    const actions = useCityActions({
        cityGameState, setCityGameState, saveGameState, worldId, userProfile, currentUser,
        getUpgradeCost, getResearchCost, getFarmCapacity, calculateUsedPopulation, isInstantUnits,
        setMessage, openModal: openCityModal, closeModal, setModalState,
        setIsInstantBuild, setIsInstantResearch, setIsInstantUnits
    });

    const { availablePopulation, happiness } = useMemo(() => {
        if (!cityGameState) return { availablePopulation: 0, happiness: 0 };
        const maxPopulation = getFarmCapacity(cityGameState.buildings?.farm?.level);
        const usedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units);
        const availablePopulation = maxPopulation - usedPopulation;
        const happinessValue = calculateHappiness(cityGameState.buildings);
        return { availablePopulation, happiness: happinessValue };
    }, [cityGameState, getFarmCapacity, calculateUsedPopulation, calculateHappiness]);

    // Re-add productionRates calculation
    const productionRates = useMemo(() => {
        if (!cityGameState) return { wood: 0, stone: 0, silver: 0 };
        return getProductionRates(cityGameState.buildings);
    }, [cityGameState, getProductionRates]);

    if (!cityGameState) {
        return <div className="text-white text-center p-10">Loading City...</div>;
    }

    return (
        <div className="w-full h-screen bg-gray-900 city-view-wrapper relative">
            <Modal message={message} onClose={() => setMessage('')} />
            
            <QuestsButton 
                onOpenQuests={() => openModal('quests')}
                quests={quests}
            />

            <SidebarNav
                onToggleView={showMap}
                view="city"
                onOpenReports={() => openModal('reports')}
                onOpenAlliance={handleOpenAlliance}
                onOpenForum={() => openModal('allianceForum')}
                onOpenMessages={() => openModal('messages')}
                onOpenSettings={() => openModal('settings')}
                onOpenProfile={() => handleOpenProfile()}
                onOpenLeaderboard={() => openModal('leaderboard')}
                onOpenQuests={() => openModal('quests')}
                unreadReportsCount={unreadReportsCount}
                unreadMessagesCount={unreadMessagesCount}
                isAdmin={userProfile?.is_admin}
                onToggleDummyCityPlacement={() => {}} // Not applicable in city view
                onOpenCheats={() => openCityModal('isCheatMenuOpen')}
            />

            <div className="h-full w-full flex flex-col overflow-hidden">
                <TopBar
                    view="city"
                    gameState={cityGameState}
                    availablePopulation={availablePopulation}
                    happiness={happiness}
                    worldState={worldState}
                    productionRates={productionRates}
                    // #comment Pass props for activity tracker
                    movements={movements}
                    onCancelTrain={onCancelTrain}
                    onCancelMovement={onCancelMovement}
                    combinedSlots={combinedSlots}
                    onOpenMovements={() => openModal('movements')}
                    isUnderAttack={isUnderAttack}
                    incomingAttackCount={incomingAttackCount}
                    onRenameCity={onRenameCity}
                    getWarehouseCapacity={getWarehouseCapacity}
                />
                <CityViewContent
                    cityGameState={cityGameState}
                    handlePlotClick={actions.handlePlotClick}
                    onOpenPowers={() => openCityModal('isDivinePowersOpen')}
                    gameSettings={gameSettings}
                />
            </div>

            <CityModals
                cityGameState={cityGameState}
                worldId={worldId}
                currentUser={currentUser}
                userProfile={userProfile}
                isInstantBuild={isInstantBuild}
                getUpgradeCost={getUpgradeCost}
                getFarmCapacity={getFarmCapacity}
                getWarehouseCapacity={getWarehouseCapacity}
                getHospitalCapacity={getHospitalCapacity}
                getProductionRates={getProductionRates}
                calculateUsedPopulation={calculateUsedPopulation}
                saveGameState={saveGameState}
                handleUpgrade={actions.handleUpgrade}
                handleCancelBuild={actions.handleCancelBuild}
                handleTrainTroops={actions.handleTrainTroops}
                handleCancelTrain={actions.handleCancelTrain} // This is the city-specific one, might need adjustment
                handleFireTroops={actions.handleFireTroops}
                handleStartResearch={actions.handleStartResearch}
                handleCancelResearch={actions.handleCancelResearch}
                handleWorshipGod={actions.handleWorshipGod}
                handleCheat={actions.handleCheat}
                handleHealTroops={actions.handleHealTroops}
                handleCancelHeal={actions.handleCancelHeal} // Also city-specific
                availablePopulation={availablePopulation}
                modalState={modalState}
                openModal={openCityModal}
                closeModal={closeModal}
                setMessage={setMessage}
                onAddWorker={actions.handleAddWorker}
                onRemoveWorker={actions.handleRemoveWorker}
                getMaxWorkerSlots={getMaxWorkerSlots}
                getMarketCapacity={getMarketCapacity}
            />
            {modalState.isDivinePowersOpen && (
                <DivinePowers
                    godName={cityGameState.god}
                    playerReligion={cityGameState.playerInfo.religion}
                    favor={cityGameState.worship[cityGameState.god] || 0}
                    onCastSpell={actions.handleCastSpell}
                    onClose={() => closeModal('isDivinePowersOpen')}
                />
            )}
        </div>
    );
};

export default CityView;
