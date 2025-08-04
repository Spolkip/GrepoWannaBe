import React from 'react';

const SidebarNav = ({ onToggleView, view, onOpenMovements, onOpenReports, onOpenAlliance, onOpenMessages, onOpenSettings, onOpenProfile, unreadReportsCount, unreadMessagesCount, isAdmin, onToggleDummyCityPlacement, onOpenForum, onOpenLeaderboard, onOpenQuests, isUnderAttack, incomingAttackCount }) => {
    return (
        <div className="sidebar">
            <h2 className="font-title text-2xl text-gray-200 mb-6 text-center">Menu</h2>
            <button onClick={onToggleView} className="sidebar-button">{view === 'map' ? 'City View' : 'Map View'}</button>
            <button onClick={onOpenQuests} className="sidebar-button">Quests</button>
            <button 
                onClick={onOpenMovements} 
                className={`sidebar-button relative ${isUnderAttack ? 'glowing-attack' : ''}`}
            >
                Movements
                {isUnderAttack && (
                    <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {incomingAttackCount}
                    </span>
                )}
            </button>
            <button 
                onClick={onOpenReports} 
                className={`sidebar-button relative ${unreadReportsCount > 0 ? 'glowing-border' : ''}`}
            >
                Reports
                {unreadReportsCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadReportsCount}
                    </span>
                )}
            </button>
            <button onClick={onOpenAlliance} className="sidebar-button">Alliance</button>
            <button onClick={onOpenForum} className="sidebar-button">Forum</button>
            <button 
                onClick={onOpenMessages} 
                className={`sidebar-button relative ${unreadMessagesCount > 0 ? 'glowing-border' : ''}`}
            >
                Messages
                {unreadMessagesCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadMessagesCount}
                    </span>
                )}
            </button>
            <button onClick={onOpenLeaderboard} className="sidebar-button">Leaderboard</button>
            <button onClick={() => onOpenProfile()} className="sidebar-button">Profile</button>
            <button onClick={onOpenSettings} className="sidebar-button">Settings</button>
            {isAdmin && view === 'map' && (
                <button onClick={onToggleDummyCityPlacement} className="sidebar-button bg-yellow-700 hover:bg-yellow-600">
                    Admin: Place Dummy City
                </button>
            )}
        </div>
    );
};

export default SidebarNav;