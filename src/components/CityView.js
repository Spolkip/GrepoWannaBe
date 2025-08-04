// src/components/CityView.js
import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './shared/Modal';
import CityHeader from './city/CityHeader';
import ResourceBar from './city/ResourceBar';
import CityModals from './city/CityModals';
import CityViewContent from './city/CityViewContent';
import DivinePowers from './city/DivinePowers';
import { useCityState } from '../hooks/useCityState';
import { useGame } from '../contexts/GameContext';
import { useCityModalManager } from '../hooks/useCityModalManager';
import { useCityActions } from '../hooks/useCityActions';
import SidebarNav from './map/SidebarNav';

const CityView = ({ 
    showMap, 
    worldId,
    openModal,
    unreadReportsCount,
    unreadMessagesCount,
    isUnderAttack,
    incomingAttackCount,
    handleOpenAlliance,
    handleOpenProfile
}) => {
    const { currentUser, userProfile } = useAuth();
    const { gameSettings, playerCities, setActiveCityId, activeCityId } = useGame();
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
        const happiness = calculateHappiness(cityGameState.buildings);
        return { availablePopulation, happiness };
    }, [cityGameState, getFarmCapacity, calculateUsedPopulation, calculateHappiness]);

    const productionRates = useMemo(() => getProductionRates(cityGameState?.buildings), [cityGameState?.buildings, getProductionRates]);

    if (!cityGameState) {
        return <div className="text-white text-center p-10">Loading City...</div>;
    }

    return (
        <div className="w-full h-screen flex flex-row bg-gray-900">
            <Modal message={message} onClose={() => setMessage('')} />
            
            <SidebarNav 
                onToggleView={showMap}
                view="city"
                onOpenMovements={() => openModal('movements')}
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
                isUnderAttack={isUnderAttack}
                incomingAttackCount={incomingAttackCount}
            />

            <div className="flex-grow flex flex-col overflow-hidden">
                <CityHeader
                    cityGameState={cityGameState}
                    worldId={worldId}
                    showMap={showMap}
                    onCityNameChange={(newName) => setCityGameState(prev => ({ ...prev, cityName: newName }))}
                    setMessage={setMessage}
                    onOpenCheats={() => openCityModal('isCheatMenuOpen')}
                    playerCities={playerCities}
                    onSelectCity={setActiveCityId}
                    activeCityId={activeCityId}
                />
                <ResourceBar
                    resources={cityGameState.resources}
                    productionRates={productionRates}
                    availablePopulation={availablePopulation}
                    happiness={happiness}
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
                handleCancelTrain={actions.handleCancelTrain}
                handleFireTroops={actions.handleFireTroops}
                handleStartResearch={actions.handleStartResearch}
                handleCancelResearch={actions.handleCancelResearch}
                handleWorshipGod={actions.handleWorshipGod}
                handleCheat={actions.handleCheat}
                handleHealTroops={actions.handleHealTroops}
                handleCancelHeal={actions.handleCancelHeal}
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