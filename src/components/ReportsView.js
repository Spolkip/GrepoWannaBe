import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';
import godsConfig from '../gameData/gods.json'; // Import gods config

// Dynamically import all images from the images and its subfolders
const images = {};

// Context for images directly in src/images (e.g., units)
const mainImageContext = require.context('../images', false, /\.(png|jpe?g|svg)$/);
mainImageContext.keys().forEach((item) => {
    const key = item.replace('./', ''); // e.g., 'swordman.png'
    images[key] = mainImageContext(item);
});

// Context for images in src/images/resources
const resourceImageContext = require.context('../images/resources', false, /\.(png|jpe?g|svg)$/);
resourceImageContext.keys().forEach((item) => {
    const key = `resources/${item.replace('./', '')}`; // e.g., 'resources/wood.png'
    images[key] = resourceImageContext(item);
});

// Context for images in src/images/buildings
const buildingImageContext = require.context('../images/buildings', false, /\.(png|jpe?g|svg)$/);
buildingImageContext.keys().forEach((item) => {
    const key = `buildings/${item.replace('./', '')}`; // e.g., 'buildings/senate.png'
    images[key] = buildingImageContext(item);
});

// Context for images in src/images/gods
const godsImageContext = require.context('../images/gods', false, /\.(png|jpe?g|svg)$/);
godsImageContext.keys().forEach((item) => {
    const key = `gods/${item.replace('./', '')}`; // e.g., 'gods/zeus.png'
    images[key] = godsImageContext(item);
});


const ReportsView = ({ onClose }) => {
    const { currentUser } = useAuth();
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [activeTab, setActiveTab] = useState('Combat');

    const tabs = {
        'Combat': ['attack', 'attack_village'],
        'Reinforce': ['reinforce'],
        'Trade': ['trade'],
        'Scout': ['scout', 'spy_caught'],
        'Misc': ['return'],
    };

    useEffect(() => {
        if (!currentUser) return;
        const reportsQuery = query(collection(db, 'users', currentUser.uid, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReports(reportsData);
        });
        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser || reports.length === 0) return;
    
        const unreadReports = reports.filter(report => !report.read);
    
        if (unreadReports.length > 0) {
            unreadReports.forEach(async (report) => {
                if (report.id) {
                    try {
                        const reportRef = doc(db, 'users', currentUser.uid, 'reports', report.id);
                        await updateDoc(reportRef, { read: true });
                    } catch (error) {
                        console.error(`Failed to mark report ${report.id} as read:`, error);
                    }
                }
            });
        }
    }, [reports, currentUser]);

    const handleSelectReport = async (report) => {
        setSelectedReport(report);
        if (!report.read) {
            const reportRef = doc(db, 'users', currentUser.uid, 'reports', report.id);
            await updateDoc(reportRef, { read: true });
        }
    };

    const handleDeleteReport = async (reportId) => {
        const reportRef = doc(db, 'users', currentUser.uid, 'reports', reportId);
        await deleteDoc(reportRef);
        if (selectedReport && selectedReport.id === reportId) {
            setSelectedReport(null);
        }
    };

    const handleTabClick = (tabName) => {
        setActiveTab(tabName);
        setSelectedReport(null);
    };
    
    const getReportTitleColor = (report) => {
        switch (report.type) {
            case 'attack':
            case 'attack_village':
                return report.outcome?.attackerWon ? 'text-green-400' : 'text-red-400';
            case 'scout':
                return report.scoutSucceeded ? 'text-green-400' : 'text-red-400';
            case 'spy_caught':
                return 'text-red-400';
            case 'return':
            case 'reinforce':
                return 'text-blue-400';
            case 'trade':
                return 'text-yellow-400';
            default:
                return 'text-gray-300';
        }
    };

    const getReportTitle = (report) => {
        let title = report.title || 'Untitled Report';
        if (report.type === 'attack' || report.type === 'attack_village') {
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
        // Direct match for image names (e.g., unit images like 'swordman.png')
        if (images[imageName]) {
            return images[imageName];
        }
        
        // Check for resource images (e.g., 'resources/wood.png')
        if (imageName.startsWith('resources/')) {
            if (images[imageName]) {
                return images[imageName];
            }
        }

        // Check for building images (e.g., 'buildings/senate.png')
        if (imageName.startsWith('buildings/')) {
             if (images[imageName]) {
                return images[imageName];
            }
        }

        // Check for god images (e.g., 'gods/zeus.png')
        if (imageName.startsWith('gods/')) {
             if (images[imageName]) {
                return images[imageName];
            }
        }
        
        console.warn(`Image not found: ${imageName}`);
        return '';
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
                        // Corrected: Ensure the image path includes the "buildings/" prefix
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
                return (
                    <div className="flex flex-col items-center">
                        <p className={`font-bold text-2xl mb-4 ${outcome.attackerWon ? 'text-green-400' : 'text-red-400'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="flex items-center justify-between w-full mb-4">
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{attacker.cityName || 'Unknown City'}</p>
                                <p className="text-sm text-gray-400">{report.originOwnerUsername || 'You'}</p>
                            </div>
                            <div className="w-1/3 text-center">
                                <img src={getImageUrl('swordman.png')} alt="Attack Icon" className="mx-auto h-12 w-auto"/>
                            </div>
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{defender.cityName || 'Unknown City'}</p>
                                <p className="text-sm text-gray-400">{report.ownerUsername || 'Opponent'}</p>
                            </div>
                        </div>

                        <div className="w-full grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="p-3 bg-gray-700/50 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-300 mb-2">Attacker Units</h4>
                                {renderTroopDisplay(attacker.units)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                            </div>
                            <div className="p-3 bg-gray-700/50 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-300 mb-2">Defender Units</h4>
                                {renderTroopDisplay(defender.units)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                            </div>
                        </div>

                        {outcome.attackerWon && outcome.plunder && (
                            <div className="w-full p-3 bg-green-800/30 rounded mt-4 text-center">
                                <h4 className="font-semibold text-lg text-green-300 mb-2">Plundered Resources</h4>
                                <div className="flex justify-center">
                                    {renderResourceIcons(outcome.plunder)}
                                </div>
                            </div>
                        )}
                        <p className="text-gray-400 mt-4">No battle points received.</p>
                    </div>
                );

            case 'attack_village':
                return (
                    <div className="flex flex-col items-center">
                        <p className={`font-bold text-2xl mb-4 ${outcome.attackerWon ? 'text-green-400' : 'text-red-400'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="flex items-center justify-between w-full mb-4">
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{attacker.cityName || 'Unknown City'}</p>
                                <p className="text-sm text-gray-400">{report.originOwnerUsername || 'You'}</p>
                            </div>
                            <div className="w-1/3 text-center">
                                <img src={getImageUrl('swordman.png')} alt="Attack Icon" className="mx-auto h-12 w-auto"/>
                            </div>
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg">{defender.villageName || 'Unknown Village'}</p>
                                <p className="text-sm text-gray-400">Neutral</p>
                            </div>
                        </div>

                        <div className="w-full grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="p-3 bg-gray-700/50 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-300 mb-2">Attacker Units</h4>
                                {renderTroopDisplay(attacker.units)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                            </div>
                            <div className="p-3 bg-gray-700/50 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-300 mb-2">Village Troops</h4>
                                {renderTroopDisplay(defender.troops)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                            </div>
                        </div>

                        {outcome.attackerWon && (
                            <p className="text-green-400 font-bold mt-4">You have conquered the village!</p>
                        )}
                        <p className="text-gray-400 mt-4">No battle points received.</p>
                    </div>
                );

            case 'scout':
                // Safely access playerReligion and god
                const scoutedGod = (report.god && report.playerReligion) ? godsConfig[report.playerReligion.toLowerCase()]?.[report.god] : null;
                return (
                    <div className="space-y-3">
                        {report.scoutSucceeded ? (
                            <>
                                <p className="font-bold text-green-400 text-lg">Scout Successful!</p>
                                <p><strong>Target City:</strong> {report.targetCityName}</p>
                                {/* Fallback for targetOwnerUsername */}
                                <p><strong>Owner:</strong> {report.targetOwnerUsername || 'Unknown'}</p>
                                {scoutedGod && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <p><strong>Worshipped God:</strong> {scoutedGod.name}</p>
                                        <img src={getImageUrl(`gods/${scoutedGod.image}`)} alt={scoutedGod.name} className="w-8 h-8"/>
                                    </div>
                                )}
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-300">Resources:</h5>
                                    <div className="flex flex-wrap gap-2">{renderResourceIcons(report.resources)}</div>
                                </div>
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-300">Units:</h5>
                                    {renderTroopDisplay(report.units)}
                                </div>
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-300">Buildings:</h5>
                                    {renderBuildingDisplay(report.buildings)}
                                </div>
                            </>
                        ) : (
                            <p className="font-bold text-red-400">{report.message || 'Scout Failed!'}</p>
                        )}
                    </div>
                );
            
            case 'return':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-blue-400">Troops Returned</p>
                        <p><strong>Surviving Units:</strong></p>
                        {renderTroopDisplay(report.units)}
                        <div className="flex flex-wrap gap-2 mt-2">
                            <strong>Loot:</strong> {renderResourceIcons(report.resources)}
                        </div>
                    </div>
                );

            case 'spy_caught':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-red-400">Spy Detected!</p>
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
                        <p className="font-bold text-blue-400">Reinforcement Arrived</p>
                        <p><strong>From:</strong> {report.originCityName}</p>
                        <p><strong>To:</strong> {report.targetCityName}</p>
                        <p><strong>Units:</strong></p>
                        {renderTroopDisplay(report.units)}
                    </div>
                );

            case 'trade':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-yellow-400">Trade Complete</p>
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
            <div className="bg-gray-800 border-2 border-gray-600 rounded-lg text-white w-full max-w-4xl h-3/4 flex flex-col">
                <div className="p-4 border-b border-gray-600 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Reports</h2>
                    <button onClick={onClose} className="text-white text-2xl">&times;</button>
                </div>

                <div className="flex flex-grow overflow-hidden">
                    <div className="w-1/3 border-r border-gray-600 flex flex-col">
                        <div className="flex border-b border-gray-600">
                            {Object.keys(tabs).map(tabName => (
                                <button
                                    key={tabName}
                                    onClick={() => handleTabClick(tabName)}
                                    className={`flex-1 p-2 text-sm font-bold transition-colors ${
                                        activeTab === tabName
                                            ? 'bg-gray-700 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                                >
                                    {tabName}
                                </button>
                            ))}
                        </div>
                        
                        <ul className="overflow-y-auto">
                            {filteredReports.length > 0 ? (
                                filteredReports.map(report => (
                                    <li
                                        key={report.id}
                                        className={`p-3 cursor-pointer border-l-4 ${selectedReport && selectedReport.id === report.id ? 'bg-gray-700 border-yellow-400' : 'border-transparent'} ${!report.read ? 'font-bold' : ''} hover:bg-gray-700`}
                                        onClick={() => handleSelectReport(report)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`truncate pr-2 ${getReportTitleColor(report)}`}>
                                                {getReportTitle(report)}
                                            </span>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }} className="text-red-500 hover:text-red-400 text-xs flex-shrink-0">Delete</button>
                                        </div>
                                        <p className="text-xs text-gray-400">{report.timestamp?.toDate().toLocaleString()}</p>
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
                                <p className="text-gray-400">Select a report to view its details.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
