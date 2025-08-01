// src/components/map/AllianceModal.js
import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import AllianceOverview from '../alliance/AllianceOverview';
import AllianceMembers from '../alliance/AllianceMembers';
import AllianceResearch from '../alliance/AllianceResearch';
import AllianceDiplomacy from '../alliance/AllianceDiplomacy';
import AllianceEvents from '../alliance/AllianceEvents'; // Import new component
import './AllianceModal.css';

const AllianceModal = ({ onClose }) => {
    const { playerAlliance } = useGame();
    const [activeTab, setActiveTab] = useState('overview');

    // This modal will now only render if the player is in an alliance.
    // The decision to show the creation modal is handled in MapView.
    if (!playerAlliance) {
        return null;
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <AllianceOverview />;
            case 'members':
                return <AllianceMembers />;
            case 'research':
                return <AllianceResearch />;
            case 'diplomacy':
                return <AllianceDiplomacy />;
            case 'events': // Add new case
                return <AllianceEvents />;
            default:
                return <AllianceOverview />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="alliance-modal" onClick={e => e.stopPropagation()}>
                <div className="alliance-modal-header">
                    <h2 className="font-title text-3xl">{playerAlliance.name} [{playerAlliance.tag}]</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="alliance-modal-tabs">
                    <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>Overview</button>
                    <button onClick={() => setActiveTab('members')} className={activeTab === 'members' ? 'active' : ''}>Members</button>
                    <button onClick={() => setActiveTab('research')} className={activeTab === 'research' ? 'active' : ''}>Research</button>
                    <button onClick={() => setActiveTab('diplomacy')} className={activeTab === 'diplomacy' ? 'active' : ''}>Diplomacy</button>
                    <button onClick={() => setActiveTab('events')} className={activeTab === 'events' ? 'active' : ''}>Events</button> 
                </div>
                <div className="alliance-modal-content">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default AllianceModal;
