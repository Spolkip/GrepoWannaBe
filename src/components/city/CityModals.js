// src/components/city/CityModals.js
import React from 'react';
import AdminCheatMenu from './AdminCheatMenu';
import BarracksMenu from './BarracksMenu';
import ShipyardMenu from './ShipyardMenu';
import BuildingDetailsModal from './BuildingDetailsModal';
import SenateView from './SenateView';
import TempleMenu from './TempleMenu';
import CaveMenu from './CaveMenu';
import HospitalMenu from './HospitalMenu';
import MarketMenu from './MarketMenu'; // #comment Import MarketMenu
import { AcademyMenu } from './AcademyMenu';
import DivineTempleMenu from './DivineTempleMenu'; // #comment Import the new DivineTempleMenu
import SpecialBuildingMenu from './SpecialBuildingMenu';
import SpecialBuildingPanel from './SpecialBuildingPanel'; // #comment Import the new panel
import HeroesAltar from './HeroesAltar';
import PrisonMenu from './PrisonMenu'; // #comment Import PrisonMenu

const CityModals = ({
  cityGameState,
  worldId,
  currentUser,
  userProfile,
  isInstantBuild,
  getUpgradeCost,
  getFarmCapacity,
  getWarehouseCapacity,
  getHospitalCapacity,
  getProductionRates,
  calculateUsedPopulation,
  saveGameState,
  handleUpgrade,
  handleCancelBuild,
  handleTrainTroops,
  handleCancelTrain,
  handleFireTroops,
  handleStartResearch,
  handleCancelResearch,
  handleWorshipGod,
  handleCheat,
  handleHealTroops,
  handleCancelHeal,
  availablePopulation,
  modalState,
  openModal,
  closeModal,
  setMessage,
  onAddWorker,
  onRemoveWorker,
  getMaxWorkerSlots,
  getMarketCapacity, // #comment Receive market capacity function
  handleBuildSpecialBuilding,
  handleDemolish,
  handleDemolishSpecialBuilding,
  handleSpawnGodTown,
  onRecruitHero,
  onActivateSkill,
  onAssignHero,
  onUnassignHero,
  onApplyWorkerPreset,
}) => {
  const {
    selectedBuildingId,
    isSenateViewOpen,
    isBarracksMenuOpen,
    isShipyardMenuOpen,
    isTempleMenuOpen,
    isCaveMenuOpen,
    isAcademyMenuOpen,
    isHospitalMenuOpen,
    isCheatMenuOpen,
    isMarketMenuOpen, // #comment Get market menu state
    isDivineTempleMenuOpen,
    isSpecialBuildingMenuOpen,
    isSpecialBuildingPanelOpen, // #comment Get panel state
    isHeroesAltarOpen,
    isPrisonMenuOpen, // #comment Get prison menu state
  } = modalState;

  if (!cityGameState) return null;

  const marketCapacity = getMarketCapacity(cityGameState.buildings?.market?.level);

  return (
    <>
      {selectedBuildingId && (
        <BuildingDetailsModal
          buildingId={selectedBuildingId}
          buildingData={cityGameState.buildings[selectedBuildingId]}
          onClose={() => closeModal('selectedBuildingId')}
          getProductionRates={getProductionRates}
          getWarehouseCapacity={getWarehouseCapacity}
          getFarmCapacity={getFarmCapacity}
          onOpenBarracks={() => { closeModal('selectedBuildingId'); openModal('isBarracksMenuOpen'); }}
          onOpenShipyard={() => { closeModal('selectedBuildingId'); openModal('isShipyardMenuOpen'); }}
          onOpenMarket={() => { closeModal('selectedBuildingId'); openModal('isMarketMenuOpen'); }} // #comment Add handler to open market
          onAddWorker={onAddWorker}
          onRemoveWorker={onRemoveWorker}
          availablePopulation={availablePopulation}
          getMaxWorkerSlots={getMaxWorkerSlots}
        />
      )}
      {isSenateViewOpen && (
        <SenateView
          buildings={cityGameState.buildings}
          resources={cityGameState.resources}
          onUpgrade={handleUpgrade}
          onDemolish={handleDemolish}
          getUpgradeCost={getUpgradeCost}
          onClose={() => closeModal('isSenateViewOpen')}
          usedPopulation={calculateUsedPopulation(cityGameState.buildings, cityGameState.units, cityGameState.specialBuilding)}
          maxPopulation={getFarmCapacity(cityGameState.buildings?.farm?.level)}
          buildQueue={cityGameState.buildQueue}
          onCancelBuild={handleCancelBuild}
          cityGameState={cityGameState}
          onOpenSpecialBuildingMenu={() => openModal('isSpecialBuildingMenuOpen')}
          onDemolishSpecialBuilding={handleDemolishSpecialBuilding}
          currentUser={currentUser}
          worldId={worldId}
          setMessage={setMessage}
          onAddWorker={onAddWorker}
          onRemoveWorker={onRemoveWorker}
          getMaxWorkerSlots={getMaxWorkerSlots}
          availablePopulation={availablePopulation}
          onApplyWorkerPreset={onApplyWorkerPreset}
        />
      )}
      {isBarracksMenuOpen && (
        <BarracksMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
          onFire={handleFireTroops}
          onClose={() => closeModal('isBarracksMenuOpen')}
          cityGameState={cityGameState}
          unitQueue={cityGameState.barracksQueue} // Pass barracksQueue
          onCancelTrain={(item) => handleCancelTrain(item, 'barracks')} // Pass item and queueType
        />
      )}
       {isDivineTempleMenuOpen && (
        <DivineTempleMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
          onClose={() => closeModal('isDivineTempleMenuOpen')}
          unitQueue={cityGameState.divineTempleQueue} // Pass divineTempleQueue
          onCancelTrain={(item) => handleCancelTrain(item, 'divineTemple')} // Pass item and queueType
          cityGameState={cityGameState}
        />
      )}
      {isShipyardMenuOpen && (
        <ShipyardMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
          onClose={() => closeModal('isShipyardMenuOpen')}
          cityGameState={cityGameState}
          unitQueue={cityGameState.shipyardQueue} // Pass shipyardQueue
          onCancelTrain={(item) => handleCancelTrain(item, 'shipyard')} // Pass item and queueType
        />
      )}
      {isTempleMenuOpen && (
        <TempleMenu
          city={cityGameState}
          onWorship={handleWorshipGod}
          onClose={() => closeModal('isTempleMenuOpen')}
          favorData={cityGameState.worship || {}}
        />
      )}
      {isAcademyMenuOpen && (
        <AcademyMenu
          cityGameState={cityGameState}
          onResearch={handleStartResearch}
          onClose={() => closeModal('isAcademyMenuOpen')}
          researchQueue={cityGameState.researchQueue}
          onCancelResearch={handleCancelResearch}
        />
      )}
      {isCaveMenuOpen && (
        <CaveMenu
          cityGameState={cityGameState}
          onClose={() => closeModal('isCaveMenuOpen')}
          saveGameState={saveGameState}
          currentUser={currentUser}
          worldId={worldId}
        />
      )}
      {isHospitalMenuOpen && (
          <HospitalMenu
              cityGameState={cityGameState}
              onClose={() => closeModal('isHospitalMenuOpen')}
              onHeal={handleHealTroops}
              onCancelHeal={handleCancelHeal}
              getHospitalCapacity={getHospitalCapacity}
              availablePopulation={availablePopulation}
          />
      )}
      {isMarketMenuOpen && (
        <MarketMenu
            onClose={() => closeModal('isMarketMenuOpen')}
            cityGameState={cityGameState}
            worldId={worldId}
            marketCapacity={marketCapacity}
        />
      )}
      {isSpecialBuildingMenuOpen && (
          <SpecialBuildingMenu
            cityGameState={cityGameState}
            onBuild={handleBuildSpecialBuilding}
            onClose={() => closeModal('isSpecialBuildingMenuOpen')}
            availablePopulation={availablePopulation}
          />
      )}
      {/* #comment Render the new SpecialBuildingPanel */}
      {isSpecialBuildingPanelOpen && (
        <SpecialBuildingPanel
            buildingId={cityGameState.specialBuilding}
            onClose={() => closeModal('isSpecialBuildingPanelOpen')}
            onDemolish={handleDemolishSpecialBuilding}
        />
      )}
      {isHeroesAltarOpen && (
        <HeroesAltar
            cityGameState={cityGameState}
            onRecruitHero={onRecruitHero}
            onActivateSkill={onActivateSkill}
            onClose={() => closeModal('isHeroesAltarOpen')}
            onAssignHero={onAssignHero}
            onUnassignHero={onUnassignHero}
        />
      )}
      {/* #comment Render the new PrisonMenu */}
      {isPrisonMenuOpen && (
        <PrisonMenu
          cityGameState={cityGameState}
          onClose={() => closeModal('isPrisonMenuOpen')}
        />
      )}
      {isCheatMenuOpen && userProfile?.is_admin && (
        <AdminCheatMenu
          onCheat={handleCheat}
          onClose={() => closeModal('isCheatMenuOpen')}
          isInstantBuildActive={isInstantBuild}
          onSpawnGodTown={handleSpawnGodTown}
        />
      )}
    </>
  );
};

export default CityModals;
