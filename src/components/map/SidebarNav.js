// src/components/map/SidebarNav.js
import React from 'react';

const SidebarNav = ({ onGoToCity, onOpenMovements, onOpenReports, onOpenAlliance, unreadReportsCount, isAdmin, onToggleDummyCityPlacement }) => {
    return (
        <div className="sidebar">
            <h2 className="font-title text-2xl text-gray-200 mb-6 text-center">Menu</h2>
            <button onClick={onGoToCity} className="sidebar-button">City View</button>
            <button onClick={onOpenMovements} className="sidebar-button">Movements</button>
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
            <button className="sidebar-button">Leaderboard</button>
            <button className="sidebar-button">Messages</button>
            <button className="sidebar-button">Settings</button>
            {isAdmin && (
                <button onClick={onToggleDummyCityPlacement} className="sidebar-button bg-yellow-700 hover:bg-yellow-600">
                    Admin: Place Dummy City
                </button>
            )}
        </div>
    );
};

export default SidebarNav;
