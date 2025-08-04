import React from 'react';

const SidebarNav = ({ onToggleView, view, onOpenMovements, onOpenReports, onOpenAlliance, onOpenMessages, onOpenSettings, onOpenProfile, unreadReportsCount, unreadMessagesCount, isAdmin, onToggleDummyCityPlacement, onOpenForum, onOpenLeaderboard, onOpenQuests, isUnderAttack, incomingAttackCount, onOpenCheats }) => {
    
    // #comment Helper component for the new button style
    const NavButton = ({ icon, text, onClick, notificationCount, glowing }) => (
        <button onClick={onClick} className={`sidebar-button ${glowing ? 'glowing-border' : ''}`}>
            <div className="icon-container">{icon}</div>
            <span className="button-text">{text}</span>
            {notificationCount > 0 && (
                <span className="notification-badge">
                    {notificationCount}
                </span>
            )}
        </button>
    );
    
    return (
        <div className="sidebar">
            <NavButton icon="🗺️" text={view === 'map' ? 'City View' : 'Map View'} onClick={onToggleView} />
            <NavButton icon="📜" text="Quests" onClick={onOpenQuests} />
            <NavButton icon="⚔️" text="Movements" onClick={onOpenMovements} notificationCount={incomingAttackCount} glowing={isUnderAttack} />
            <NavButton icon="✉️" text="Reports" onClick={onOpenReports} notificationCount={unreadReportsCount} glowing={unreadReportsCount > 0} />
            <NavButton icon="🛡️" text="Alliance" onClick={onOpenAlliance} />
            <NavButton icon="📖" text="Forum" onClick={onOpenForum} />
            <NavButton icon="💬" text="Messages" onClick={onOpenMessages} notificationCount={unreadMessagesCount} glowing={unreadMessagesCount > 0} />
            <NavButton icon="🏆" text="Leaderboard" onClick={onOpenLeaderboard} />
            <NavButton icon="👤" text="Profile" onClick={() => onOpenProfile()} />
            <NavButton icon="⚙️" text="Settings" onClick={onOpenSettings} />
            {isAdmin && view === 'city' && (
                 <NavButton icon="🔧" text="Admin Cheats" onClick={onOpenCheats} />
            )}
            {isAdmin && view === 'map' && (
                <button onClick={onToggleDummyCityPlacement} className="sidebar-button bg-yellow-700 hover:bg-yellow-600">
                     <div className="icon-container">👑</div>
                     <span className="button-text">Place Dummy</span>
                </button>
            )}
        </div>
    );
};

export default SidebarNav;
