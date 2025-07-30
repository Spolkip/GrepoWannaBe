// src/components/shared/SettingsModal.js
import React, { useState } from 'react';
import Modal from './Modal'; // Assuming you have a reusable Modal component

const SettingsModal = ({ onClose, onSaveSettings, initialSettings }) => {
    const [settings, setSettings] = useState(initialSettings || {
        animations: true,
        confirmActions: true,
    });

    const handleChange = (e) => {
        const { name, type, checked, value } = e.target;
        setSettings(prevSettings => ({
            ...prevSettings,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {
        onSaveSettings(settings);
        onClose();
    };

    return (
        <Modal onClose={onClose} title="Settings">
            <div className="p-4 bg-gray-800 text-white rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">Game Settings</h2>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                        <label htmlFor="animations" className="text-lg font-semibold">Enable Animations</label>
                        <input
                            type="checkbox"
                            id="animations"
                            name="animations"
                            checked={settings.animations}
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
                            checked={settings.confirmActions}
                            onChange={handleChange}
                            className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                        />
                    </div>
                    {/* Add more settings here */}
                </div>

                <div className="mt-6 flex justify-center space-x-4">
                    <button
                        onClick={handleSave}
                        className="btn btn-confirm py-2 px-6"
                    >
                        Save Settings
                    </button>
                    <button
                        onClick={onClose}
                        className="btn btn-primary py-2 px-6"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SettingsModal;