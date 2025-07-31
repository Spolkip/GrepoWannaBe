import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import AllianceOverview from '../alliance/AllianceOverview';
import AllianceMembers from '../alliance/AllianceMembers';
import AllianceResearch from '../alliance/AllianceResearch';
import AllianceDiplomacy from '../alliance/AllianceDiplomacy';
import './AllianceModal.css';

const AllianceModal = ({ onClose }) => {
    const { playerAlliance } = useGame();
    const [activeTab, setActiveTab] = useState('overview');

    if (!playerAlliance) {
        // TODO: Add UI for creating or joining an alliance
        return (
            <div className="modal-backdrop" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <p>You are not in an alliance.</p>
                </div>
            </div>
        );
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
            default:
                return <AllianceOverview />;
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
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
                </div>
                <div className="alliance-modal-content">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default AllianceModal;
