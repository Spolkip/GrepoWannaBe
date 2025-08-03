import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import AllianceOverview from '../alliance/AllianceOverview';
import AllianceMembers from '../alliance/AllianceMembers';
import AllianceResearch from '../alliance/AllianceResearch';
import AllianceDiplomacy from '../alliance/AllianceDiplomacy';
import AllianceSettings from '../alliance/AllianceSettings';
import AllianceInvitations from '../alliance/AllianceInvitations';
import AllianceRanks from '../alliance/AllianceRanks';
import AllianceProperties from '../alliance/AllianceProperties';
import './AllianceModal.css';

const AllianceModal = ({ onClose }) => {
    const { playerAlliance } = useGame();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');

    if (!currentUser || !playerAlliance) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
                <div className="bg-gray-800 p-6 rounded-lg text-white">
                    Loading alliance data...
                </div>
            </div>
        );
    }

    const isLeader = currentUser.uid === playerAlliance.leader.uid;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return <AllianceOverview />;
            case 'members': return <AllianceMembers />;
            case 'research': return <AllianceResearch />;
            case 'diplomacy': return <AllianceDiplomacy />;
            case 'settings': return <AllianceSettings alliance={playerAlliance} isLeader={isLeader} />;
            case 'invitations': return <AllianceInvitations alliance={playerAlliance} isLeader={isLeader} />;
            case 'ranks': return <AllianceRanks alliance={playerAlliance} isLeader={isLeader} />;
            case 'properties': return <AllianceProperties onClose={onClose} />;
            default: return <AllianceOverview />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="alliance-modal" onClick={e => e.stopPropagation()}>
                <div className="alliance-modal-header">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{playerAlliance.name}</h2>
                        <p className="text-gray-300">[{playerAlliance.tag}]</p>
                    </div>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                
                <div className="alliance-modal-tabs">
                    <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>Overview</button>
                    <button onClick={() => setActiveTab('members')} className={activeTab === 'members' ? 'active' : ''}>Members</button>
                    <button onClick={() => setActiveTab('research')} className={activeTab === 'research' ? 'active' : ''}>Research</button>
                    <button onClick={() => setActiveTab('diplomacy')} className={activeTab === 'diplomacy' ? 'active' : ''}>Diplomacy</button>
                    <button onClick={() => setActiveTab('properties')} className={activeTab === 'properties' ? 'active' : ''}>Properties</button>
                    {isLeader && (
                        <>
                            <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'active' : ''}>Settings</button>
                            <button onClick={() => setActiveTab('invitations')} className={activeTab === 'invitations' ? 'active' : ''}>Invitations</button>
                            <button onClick={() => setActiveTab('ranks')} className={activeTab === 'ranks' ? 'active' : ''}>Ranks</button>
                        </>
                    )}
                </div>
                
                <div className="alliance-modal-content">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default AllianceModal;
