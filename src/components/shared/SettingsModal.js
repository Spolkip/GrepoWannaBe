// src/components/shared/SettingsModal.js
import React from 'react';
import { useGame } from '../../contexts/GameContext';

const SettingsModal = ({ onClose }) => {
    const { gameSettings, setGameSettings } = useGame();

    const handleChange = (e) => {
        const { name, type, checked, value } = e.target;
        setGameSettings(prevSettings => ({
            ...prevSettings,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {
        // Settings are saved on change, so this just closes the modal
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-center text-yellow-400">Game Settings</h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                        <label htmlFor="showVisuals" className="text-lg font-semibold">Enable Visuals</label>
                        <input
                            type="checkbox"
                            id="showVisuals"
                            name="showVisuals"
                            checked={gameSettings.showVisuals}
                            onChange={handleChange}
                            className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                        <label htmlFor="showGrid" className="text-lg font-semibold">Enable Grid</label>
                        <input
                            type="checkbox"
                            id="showGrid"
                            name="showGrid"
                            checked={gameSettings.showGrid}
                            onChange={handleChange}
                            className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                        />
                    </div>
                    
                    <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                        <label htmlFor="animations" className="text-lg font-semibold">Enable Animations</label>
                        <input
                            type="checkbox"
                            id="animations"
                            name="animations"
                            checked={gameSettings.animations}
                            onChange={handleChange}
                            className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                        <label htmlFor="confirmActions" className="text-lg font-semibold">Confirm Destructive Actions</label>
                        <input
                            type="checkbox"
                            id="confirmActions"
                            name="confirmActions"
                            checked={gameSettings.confirmActions}
                            onChange={handleChange}
                            className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-center space-x-4">
                    <button
                        onClick={handleSave}
                        className="btn btn-confirm py-2 px-6"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
