// src/components/map/AllianceModal.js
import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import AllianceOverview from '../alliance/AllianceOverview';
import AllianceMembers from '../alliance/AllianceMembers';
import AllianceResearch from '../alliance/AllianceResearch';
import AllianceDiplomacy from '../alliance/AllianceDiplomacy';
import AllianceEvents from '../alliance/AllianceEvents';
import AllianceSettings from '../alliance/AllianceSettings';
import AllianceInvitations from '../alliance/AllianceInvitations';
import AllianceRanks from '../alliance/AllianceRanks';
import './AllianceModal.css';

const AllianceModal = ({ onClose }) => {
    const { playerAlliance, currentUser } = useGame();
    const [activeTab, setActiveTab] = useState('overview');

    // Added for debugging to check if the leader check is working
    // This hook is now placed unconditionally at the top level of the component
    useEffect(() => {
        console.log('AllianceModal loaded.');
        console.log('Current User:', currentUser);
        console.log('Player Alliance:', playerAlliance);
        const isLeader = currentUser && playerAlliance?.leader?.uid === currentUser?.uid;
        console.log('Is Leader (from useEffect):', isLeader);
    }, [currentUser, playerAlliance]);

    // This modal will only render if the player is in an alliance.
    if (!playerAlliance) {
        return null;
    }

    // Determine if the current user is the alliance leader.
    // The new tabs are only visible to the leader.
    const isLeader = currentUser && playerAlliance?.leader?.uid === currentUser?.uid;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <AllianceOverview playerAlliance={playerAlliance} isLeader={isLeader} />;
            case 'members':
                return <AllianceMembers playerAlliance={playerAlliance} />;
            case 'research':
                return <AllianceResearch playerAlliance={playerAlliance} />;
            case 'diplomacy':
                return <AllianceDiplomacy playerAlliance={playerAlliance} />;
            case 'events':
                return <AllianceEvents playerAlliance={playerAlliance} />;
            case 'settings':
                return <AllianceSettings alliance={playerAlliance} isLeader={isLeader} />;
            case 'invitations':
                return <AllianceInvitations alliance={playerAlliance} isLeader={isLeader} />;
            case 'ranks':
                return <AllianceRanks alliance={playerAlliance} isLeader={isLeader} />;
            default:
                return <AllianceOverview playerAlliance={playerAlliance} isLeader={isLeader} />;
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
