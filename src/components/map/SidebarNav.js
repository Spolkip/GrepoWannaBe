import React from 'react';

// SidebarNav component provides navigation links for various game views and admin actions.
const SidebarNav = ({ onGoToCity, onOpenMovements, onOpenReports, isAdmin, onToggleDummyCityPlacement }) => {
    return (
        <div className="sidebar">
            <h2 className="font-title text-2xl text-gray-200 mb-6 text-center">Menu</h2>
            {/* Navigation buttons */}
            <button onClick={onGoToCity} className="sidebar-button">City View</button>
            <button onClick={onOpenMovements} className="sidebar-button">Movements</button>
            <button onClick={onOpenReports} className="sidebar-button">Reports</button>
            <button className="sidebar-button">Alliance</button>
            <button className="sidebar-button">Leaderboard</button>
            <button className="sidebar-button">Messages</button>
            <button className="sidebar-button">Settings</button>
            {/* Admin-only button for placing dummy cities */}
            {isAdmin && (
                <button onClick={onToggleDummyCityPlacement} className="sidebar-button bg-yellow-700 hover:bg-yellow-600">
                    Admin: Place Dummy City
                </button>
            )}
        </div>
    );
};

export default SidebarNav;
