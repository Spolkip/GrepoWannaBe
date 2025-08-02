import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import AllianceOverview from '../alliance/AllianceOverview';
import AllianceMembers from '../alliance/AllianceMembers';
import AllianceResearch from '../alliance/AllianceResearch';
import AllianceDiplomacy from '../alliance/AllianceDiplomacy';
import AllianceEvents from '../alliance/AllianceEvents';
import AllianceSettings from '../alliance/AllianceSettings';
import AllianceInvitations from '../alliance/AllianceInvitations';
import AllianceRanks from '../alliance/AllianceRanks';
import { useAuth } from '../../contexts/AuthContext'; // Add this import
import './AllianceModal.css';

const AllianceModal = ({ onClose }) => {
    const { playerAlliance} = useGame();
     const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');

    if (!playerAlliance) {
        return null;
    }

    const isLeader = Boolean(
        currentUser?.uid && 
        playerAlliance?.leader?.uid && 
        currentUser.uid === playerAlliance.leader.uid
    );

    console.log('Leader Check:', {
        currentUserId: currentUser?.uid,
        leaderId: playerAlliance?.leader?.uid,
        isLeader
    });

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return <AllianceOverview />;
            case 'members': return <AllianceMembers />;
            case 'research': return <AllianceResearch />;
            case 'diplomacy': return <AllianceDiplomacy />;
            case 'events': return <AllianceEvents />;
            case 'settings': return <AllianceSettings alliance={playerAlliance} isLeader={isLeader} />;
            case 'invitations': return <AllianceInvitations alliance={playerAlliance} isLeader={isLeader} />;
            case 'ranks': return <AllianceRanks alliance={playerAlliance} isLeader={isLeader} />;
            default: return <AllianceOverview />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="alliance-modal" onClick={e => e.stopPropagation()}>
                <div className="alliance-modal-header">
                    <h2 className="font-title text-3xl">{playerAlliance.name} [{playerAlliance.tag}]</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                
                {/* Debug info - remove after fixing */}
                <div className="bg-red-900 p-2 text-white text-xs">
                    <p>Debug Info:</p>
                    <p>Current User ID: {currentUser?.uid}</p>
                    <p>Leader ID: {playerAlliance?.leader?.uid}</p>
                    <p>Is Leader: {isLeader ? 'YES' : 'NO'}</p>
                </div>
                
                <div className="alliance-modal-tabs">
                    <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>Overview</button>
                    <button onClick={() => setActiveTab('members')} className={activeTab === 'members' ? 'active' : ''}>Members</button>
                    <button onClick={() => setActiveTab('research')} className={activeTab === 'research' ? 'active' : ''}>Research</button>
                    <button onClick={() => setActiveTab('diplomacy')} className={activeTab === 'diplomacy' ? 'active' : ''}>Diplomacy</button>
                    <button onClick={() => setActiveTab('events')} className={activeTab === 'events' ? 'active' : ''}>Events</button>
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