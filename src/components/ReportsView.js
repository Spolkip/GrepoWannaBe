// src/components/ReportsView.js
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext'; // Import useGame
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';
import godsConfig from '../gameData/gods.json';
import ruinsResearch from '../gameData/ruinsResearch.json';
import './ReportsView.css'; // Import the new CSS

// (Image import logic remains the same)
const images = {};
const imageContexts = [
    require.context('../images', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/resources', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/gods', false, /\.(png|jpe?g|svg)$/),
];
imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const keyWithSubdir = context.id.includes('/resources') ? `resources/${item.replace('./', '')}` :
                              context.id.includes('/buildings') ? `buildings/${item.replace('./', '')}` :
                              context.id.includes('/gods') ? `gods/${item.replace('./', '')}` :
                              item.replace('./', '');
        images[keyWithSubdir] = context(item);
    });
});


const ReportsView = ({ onClose }) => {
    const { currentUser } = useAuth();
    const { worldId } = useGame(); // Get worldId from context
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [activeTab, setActiveTab] = useState('Combat');
    const tabs = {
        'Combat': ['attack', 'attack_village', 'attack_ruin'],
        'Reinforce': ['reinforce'],
        'Trade': ['trade'],
        'Scout': ['scout', 'spy_caught'],
        'Misc': ['return', 'spell_cast', 'spell_received', 'spell_fail'],
    };

    useEffect(() => {
        if (!currentUser || !worldId) return;
        // #comment Update query to be world-specific
        const reportsQuery = query(collection(db, 'users', currentUser.uid, 'worlds', worldId, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReports(reportsData);
        });
        return () => unsubscribe();
    }, [currentUser, worldId]);

    const handleSelectReport = async (report) => {
        setSelectedReport(report);
        if (!report.read) {
            // #comment Update path to be world-specific
            const reportRef = doc(db, 'users', currentUser.uid, 'worlds', worldId, 'reports', report.id);
            await updateDoc(reportRef, { read: true });
        }
    };

    const handleDeleteReport = async (reportId) => {
        // #comment Update path to be world-specific
        const reportRef = doc(db, 'users', currentUser.uid, 'worlds', worldId, 'reports', reportId);
        await deleteDoc(reportRef);
        if (selectedReport && selectedReport.id === reportId) {
            setSelectedReport(null);
        }
    };

    const handleTabClick = (tabName) => {
        setActiveTab(tabName);
        setSelectedReport(null);
    };

    // (Rendering logic remains the same, no changes needed there)
    const getReportTitleColor = (report) => {
        switch (report.type) {
            case 'attack':
            case 'attack_village':
            case 'attack_ruin':
                return report.outcome?.attackerWon ? 'text-green-600' : 'text-red-600';
            case 'scout':
                return report.scoutSucceeded ? 'text-green-600' : 'text-red-600';
            case 'spy_caught':
                return 'text-red-600';
            case 'spell_cast':
            case 'spell_received':
                return 'text-purple-600';
            case 'spell_fail':
                return 'text-red-600';
            case 'return':
            case 'reinforce':
                return 'text-blue-600';
            case 'trade':
                return 'text-yellow-600';
            default:
                return 'text-gray-800';
        }
    };

    const getReportTitle = (report) => {
        let title = report.title || 'Untitled Report';
        if (report.type === 'attack' || report.type === 'attack_village' || report.type === 'attack_ruin') {
            title += report.outcome?.attackerWon ? ' (Victory)' : ' (Defeat)';
        }
        return title;
    };

    const renderUnitList = (units) => {
        if (!units || Object.keys(units).length === 0) return 'None';
        return Object.entries(units)
            .map(([id, count]) => `${count} ${unitConfig[id]?.name || id}`)
            .join(', ');
    };

    const getImageUrl = (imageName) => {
        if (!imageName || !images[imageName]) {
            console.warn(`Image not found: ${imageName}`);
            return '';
        }
        return images[imageName];
    };

    const renderTroopDisplay = (units) => {
        if (!units || Object.keys(units).length === 0) return null;
        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                {Object.entries(units).map(([unitId, count]) => {
                    if (count > 0) {
                        const unit = unitConfig[unitId];
                        const imageSrc = getImageUrl(unit?.image || '');
                        return (
                            <div key={unitId} className="flex flex-col items-center">
                                {imageSrc && <img src={imageSrc} alt={unit?.name || unitId} className="w-8 h-8"/>}
                                <span className="text-sm">{count}</span>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    const renderResourceIcons = (resources) => {
        return Object.entries(resources || {}).map(([res, amount]) => {
            const imagePath = `resources/${res}.png`;
            const imageSrc = getImageUrl(imagePath);
            return (
                <div key={res} className="flex flex-col items-center mx-2">
                    {imageSrc && <img src={imageSrc} alt={res} className="w-8 h-8"/>}
                    <span className="text-sm">{Math.floor(amount)}</span>
                </div>
            );
        });
    };

    const renderBuildingDisplay = (buildings) => {
        if (!buildings || Object.keys(buildings).length === 0) return null;
        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                {Object.entries(buildings).map(([buildingId, data]) => {
                    if (data.level > 0) {
                        const building = buildingConfig[buildingId];
                        const imageSrc = getImageUrl(`buildings/${building?.image}` || '');
                        return (
                            <div key={buildingId} className="flex flex-col items-center">
                                {imageSrc && <img src={imageSrc} alt={building?.name || buildingId} className="w-8 h-8"/>}
                                <span className="text-sm">{building?.name || buildingId} (Lvl {data.level})</span>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    const renderReportOutcome = (report) => {
        const outcome = report.outcome || {};
        const attacker = report.attacker || {};
        const defender = report.defender || {};
        switch (report.type) {
            case 'attack':
            case 'attack_village':
                return (
                    <div className="flex flex-col items-center">
                        <p className={`font-bold text-2xl mb-4 ${outcome.attackerWon ? 'text-green-600' : 'text-red-600'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="flex items-center justify-between w-full mb-4">
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{attacker.cityName || 'Unknown City'}</p>
                                <p className="text-sm text-gray-500">{report.originOwnerUsername || 'You'}</p>
                            </div>
                            <div className="w-1/3 text-center">
                                <img src={getImageUrl('swordman.png')} alt="Attack Icon" className="mx-auto h-12 w-auto"/>
                            </div>
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{defender.cityName || defender.villageName || 'Unknown'}</p>
                                <p className="text-sm text-gray-500">{report.type === 'attack_village' ? 'Neutral' : (report.ownerUsername || 'Opponent')}</p>
                            </div>
                        </div>
                        <div className="w-full grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Attacker Units</h4>
                                {renderTroopDisplay(attacker.units)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                                {outcome.wounded && Object.keys(outcome.wounded).length > 0 && (
                                    <p className="mt-2 text-orange-600"><strong>Wounded:</strong> {renderUnitList(outcome.wounded)}</p>
                                )}
                            </div>
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Defender Units</h4>
                                {renderTroopDisplay(defender.units || defender.troops)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                            </div>
                        </div>
                        {outcome.attackerWon && outcome.plunder && (
                            <div className="w-full p-3 bg-green-800/10 rounded mt-4 text-center">
                                <h4 className="font-semibold text-lg text-green-700 mb-2">Plundered Resources</h4>
                                <div className="flex justify-center">
                                    {renderResourceIcons(outcome.plunder)}
                                </div>
                            </div>
                        )}
                        <p className="text-gray-500 mt-4">No battle points received.</p>
                    </div>
                );
            case 'attack_ruin':
                return (
                    <div className="flex flex-col items-center">
                        <p className={`font-bold text-2xl mb-4 ${outcome.attackerWon ? 'text-green-600' : 'text-red-600'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="flex items-center justify-between w-full mb-4">
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{attacker.cityName || 'Unknown City'}</p>
                                <p className="text-sm text-gray-500">{report.originOwnerUsername || 'You'}</p>
                            </div>
                            <div className="w-1/3 text-center">
                                <img src={getImageUrl('swordman.png')} alt="Attack Icon" className="mx-auto h-12 w-auto"/>
                            </div>
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{defender.ruinName || 'Ancient Ruins'}</p>
                                <p className="text-sm text-gray-500">Ancient Guardians</p>
                            </div>
                        </div>
                        <div className="w-full grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Attacker Units</h4>
                                {renderTroopDisplay(attacker.units)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                                {outcome.wounded && Object.keys(outcome.wounded).length > 0 && (
                                    <p className="mt-2 text-orange-600"><strong>Wounded:</strong> {renderUnitList(outcome.wounded)}</p>
                                )}
                            </div>
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Guardian Units</h4>
                                {renderTroopDisplay(defender.troops)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                            </div>
                        </div>
                        {report.reward && (
                            <div className="w-full p-3 bg-green-800/10 rounded mt-4 text-center">
                                <h4 className="font-semibold text-lg text-green-700 mb-2">Research Unlocked!</h4>
                                <p>{ruinsResearch[report.reward]?.name}</p>
                            </div>
                        )}
                    </div>
                );
            case 'scout':
                const scoutedGod = (report.god && report.playerReligion) ? godsConfig[report.playerReligion.toLowerCase()]?.[report.god] : null;
                return (
                    <div className="space-y-3">
                        {report.scoutSucceeded ? (
                            <>
                                <p className="font-bold text-green-600 text-lg">Scout Successful!</p>
                                <p><strong>Target City:</strong> {report.targetCityName}</p>
                                <p><strong>Owner:</strong> {report.targetOwnerUsername || 'Unknown'}</p>
                                {scoutedGod && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <p><strong>Worshipped God:</strong> {scoutedGod.name}</p>
                                        <img src={getImageUrl(`gods/${scoutedGod.image}`)} alt={scoutedGod.name} className="w-8 h-8"/>
                                    </div>
                                )}
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-700">Resources:</h5>
                                    <div className="flex flex-wrap gap-2">{renderResourceIcons(report.resources)}</div>
                                </div>
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-700">Units:</h5>
                                    {renderTroopDisplay(report.units)}
                                </div>
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-700">Buildings:</h5>
                                    {renderBuildingDisplay(report.buildings)}
                                </div>
                            </>
                        ) : (
                            <p className="font-bold text-red-600">{report.message || 'Scout Failed!'}</p>
                        )}
                    </div>
                );
            case 'spell_cast':
            case 'spell_received':
            case 'spell_fail':
                return (
                    <div className="space-y-2 text-center">
                        <p className="font-bold text-lg">{report.title}</p>
                        <p>{outcome.message}</p>
                        {outcome.from && <p className="text-sm text-gray-500">From: {outcome.from}</p>}
                    </div>
                );
            case 'return':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-blue-600">Troops Returned</p>
                        <p><strong>Surviving Units:</strong></p>
                        {renderTroopDisplay(report.units)}
                        {report.wounded && Object.keys(report.wounded).length > 0 && (
                            <>
                                <p className="font-bold text-orange-600 mt-2">Wounded Units:</p>
                                {renderTroopDisplay(report.wounded)}
                            </>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                            <strong>Loot:</strong> {renderResourceIcons(report.resources)}
                        </div>
                    </div>
                );
            case 'spy_caught':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-red-600">Spy Detected!</p>
                        <p>A spy from {report.originCityName || 'an unknown city'} was detected.</p>
                        {report.silverGained > 0 && (
                            <div className="flex items-center gap-2">
                                <p>You gained:</p> {renderResourceIcons({ silver: report.silverGained })}
                            </div>
                        )}
                    </div>
                );
            case 'reinforce':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-blue-600">Reinforcement Arrived</p>
                        <p><strong>From:</strong> {report.originCityName}</p>
                        <p><strong>To:</strong> {report.targetCityName}</p>
                        <p><strong>Units:</strong></p>
                        {renderTroopDisplay(report.units)}
                    </div>
                );
            case 'trade':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-yellow-600">Trade Complete</p>
                        <p><strong>From:</strong> {report.originCityName}</p>
                        <p><strong>To:</strong> {report.targetCityName}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <strong>Resources:</strong> {renderResourceIcons(report.resources)}
                        </div>
                    </div>
                );
            default:
                return <p>Report type not recognized.</p>;
        }
    };

    const filteredReports = reports.filter(report => tabs[activeTab]?.includes(report.type));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="reports-container">
                <div className="reports-header">
                    <h2 className="font-title text-3xl">Reports</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="flex flex-grow overflow-hidden">
                    <div className="w-1/3 border-r-2 border-[#8B4513] flex flex-col">
                        <div className="reports-tabs">
                            {Object.keys(tabs).map(tabName => {
                                const unreadCount = reports.filter(report => tabs[tabName].includes(report.type) && !report.read).length;
                                const hasUnread = unreadCount > 0;
                                return (
                                    <button
                                        key={tabName}
                                        onClick={() => handleTabClick(tabName)}
                                        className={`tab-btn ${activeTab === tabName ? 'active' : ''} ${hasUnread ? 'glowing-tab' : ''}`}
                                    >
                                        {tabName}
                                        {hasUnread && <span className="tab-badge">{unreadCount}</span>}
                                    </button>
                                )
                            })}
                        </div>
                        <ul className="overflow-y-auto reports-list">
                            {filteredReports.length > 0 ? (
                                filteredReports.map(report => (
                                    <li
                                        key={report.id}
                                        className={`report-item ${selectedReport && selectedReport.id === report.id ? 'selected' : ''} ${!report.read ? 'unread' : ''}`}
                                        onClick={() => handleSelectReport(report)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`truncate pr-2 ${getReportTitleColor(report)}`}>
                                                {getReportTitle(report)}
                                            </span>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }} className="delete-btn">&times;</button>
                                        </div>
                                        <p className="text-xs text-gray-500">{report.timestamp?.toDate().toLocaleString()}</p>
                                    </li>
                                ))
                            ) : (
                                <p className="p-4 text-center text-gray-500">No reports in this category.</p>
                            )}
                        </ul>
                    </div>
                    <div className="w-2/3 p-4 overflow-y-auto">
                        {selectedReport ? (
                            <div>
                                <h3 className="text-lg font-bold mb-2">{selectedReport.title || 'Report Details'}</h3>
                                <div className="space-y-2">
                                    {renderReportOutcome(selectedReport)}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500">Select a report to view its details.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
