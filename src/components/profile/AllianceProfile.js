import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';

const AllianceProfile = ({ allianceId, onClose, onOpenProfile }) => {
    const { worldId } = useGame();
    const { playerAlliance, applyToAlliance, sendAllyRequest, joinOpenAlliance } = useAlliance();
    const { currentUser } = useAuth();
    const [allianceData, setAllianceData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchAllianceData = async () => {
            if (!worldId || !allianceId) return;
            setLoading(true);
            try {
                const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
                const allianceSnap = await getDoc(allianceRef);
                if (allianceSnap.exists()) {
                    setAllianceData({ id: allianceSnap.id, ...allianceSnap.data() });
                } else {
                    setMessage('Alliance not found.');
                }
            } catch (error) {
                console.error("Error fetching alliance data:", error);
                setMessage('Failed to load alliance data.');
            }
            setLoading(false);
        };
        fetchAllianceData();
    }, [worldId, allianceId]);

    const handleJoin = async () => {
        if (!allianceData) return;
        setMessage('Joining alliance...');
        try {
            await joinOpenAlliance(allianceId);
            setMessage('Successfully joined!');
            onClose(); // Close profile on successful join
        } catch (error) {
            console.error("Error joining alliance:", error);
            setMessage(`Failed to join: ${error.message}`);
        }
    };

    const handleApply = async () => {
        if (!allianceData) return;
        setMessage('Sending application...');
        try {
            await applyToAlliance(allianceId);
            setMessage('Application sent!');
        } catch (error) {
            console.error("Error applying to alliance:", error);
            setMessage(`Failed to send application: ${error.message}`);
        }
    };
    
    const handleSendAllyRequest = async () => {
        if (!allianceData) return;
        setMessage('Sending ally request...');
        try {
            await sendAllyRequest(allianceData.id);
            setMessage('Ally request sent!');
        } catch (error) {
            console.error("Error sending ally request:", error);
            setMessage(`Failed to send request: ${error.message}`);
        }
    };

    const renderJoinButton = () => {
        if (playerAlliance) return null; // Already in an alliance

        const status = allianceData?.settings?.status;
        switch (status) {
            case 'open':
                return <button onClick={handleJoin} className="profile-edit-button !static">Join Alliance</button>;
            case 'invite_only':
                return <button onClick={handleApply} className="profile-edit-button !static">Apply to Join</button>;
            case 'closed':
                return <p className="text-sm text-gray-400">This alliance is closed.</p>;
            default:
                return null;
        }
    };

    const isMyAlliance = playerAlliance && playerAlliance.id === allianceId;
    const canSendAllyRequest = playerAlliance && !isMyAlliance && playerAlliance.leader.uid === currentUser.uid;

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                <div className="bg-gray-800 p-6 rounded-lg text-white">Loading Alliance Profile...</div>
            </div>
        );
    }

    if (!allianceData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
                <div className="bg-gray-800 p-6 rounded-lg text-white" onClick={e => e.stopPropagation()}>
                    <p>{message || 'Could not load alliance profile.'}</p>
                    <button onClick={onClose} className="btn btn-primary mt-4">Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="profile-papyrus !h-auto max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="profile-close-button">&times;</button>
                <div className="flex flex-col p-4">
                    <div className="text-center mb-4">
                        <h2 className="font-title text-3xl">{allianceData.name} [{allianceData.tag}]</h2>
                        <p className="text-sm italic mt-2 p-2 bg-black/10 rounded">{allianceData.settings?.description || 'No description provided.'}</p>
                    </div>

                    <div className="flex-grow overflow-y-auto">
                        <h3 className="font-title text-xl mb-2 text-center">Members ({allianceData.members.length})</h3>
                        <ul className="space-y-1">
                            {allianceData.members.map(member => (
                                <li key={member.uid} className="flex justify-between p-2 bg-black/5 rounded">
                                    <button onClick={() => { onClose(); onOpenProfile(member.uid); }} className="player-name-btn">
                                        {member.username}
                                    </button>
                                    <span className="font-bold">{member.rank}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-4 pt-4 border-t-2 border-[#8B4513] flex justify-center gap-4">
                        {renderJoinButton()}
                        {canSendAllyRequest && <button onClick={handleSendAllyRequest} className="profile-edit-button !static">Send Ally Request</button>}
                    </div>
                    {message && <p className="text-center mt-2">{message}</p>}
                </div>
            </div>
        </div>
    );
};

export default AllianceProfile;
