import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';

const AllianceInvitations = ({ alliance, isLeader }) => {
    const { worldId, playerAlliance, sendAllianceInvitation, revokeAllianceInvitation } = useGame();
    const { userProfile } = useAuth();
    const [invitedPlayerName, setInvitedPlayerName] = useState('');
    const [pendingInvites, setPendingInvites] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!worldId || !playerAlliance?.id) return;
        const invitesRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'invitations');
        const unsubscribe = onSnapshot(invitesRef, (snapshot) => {
            const invitesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingInvites(invitesData);
        });
        return () => unsubscribe();
    }, [worldId, playerAlliance]);

    const handleInvite = async () => {
        if (!invitedPlayerName.trim()) {
            setMessage('Please enter a player name.');
            return;
        }

        try {
            const usersQuery = query(collection(db, 'users'), where('username', '==', invitedPlayerName.trim()));
            const userSnapshot = await getDocs(usersQuery);

            if (userSnapshot.empty) {
                setMessage('Player not found.');
                return;
            }
            
            const invitedUserId = userSnapshot.docs[0].id;
            const existingInvite = pendingInvites.find(invite => invite.invitedUserId === invitedUserId);
            if (existingInvite) {
                setMessage('An invitation has already been sent to this player.');
                return;
            }

            await sendAllianceInvitation(invitedUserId);
            setMessage(`Invitation sent to ${invitedPlayerName}!`);
            setInvitedPlayerName('');
        } catch (e) {
            setMessage('Failed to send invitation. Please try again.');
            console.error(e);
        }
    };

    const handleRevoke = async (invitedUserId) => {
        await revokeAllianceInvitation(invitedUserId);
        setMessage('Invitation revoked.');
    };

    const canInvite = isLeader;

    return (
        <div className="p-4">
            <h3 className="text-xl font-bold mb-4">Invitations</h3>
            {!canInvite && <p className="text-red-400 mb-4">You do not have permission to manage invitations.</p>}
            {canInvite && (
                <div className="mb-6 space-y-2">
                    <p className="font-semibold">Invite a Player</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={invitedPlayerName}
                            onChange={(e) => setInvitedPlayerName(e.target.value)}
                            placeholder="Player Username"
                            className="w-full bg-gray-900 p-2 rounded"
                        />
                        <button onClick={handleInvite} className="btn btn-confirm flex-shrink-0">Invite</button>
                    </div>
                </div>
            )}
            <div className="mt-6">
                <p className="font-semibold mb-2">Pending Invitations</p>
                {pendingInvites.length > 0 ? (
                    <ul className="space-y-2">
                        {pendingInvites.map(invite => (
                            <li key={invite.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                <span>{invite.invitedUsername}</span>
                                {canInvite && (
                                    <button onClick={() => handleRevoke(invite.invitedUserId)} className="btn btn-danger text-sm px-2 py-1">Revoke</button>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-400 text-sm italic">No invitations have been sent.</p>
                )}
            </div>
            {message && <p className="text-green-400 mt-2 text-sm">{message}</p>}
        </div>
    );
};

export default AllianceInvitations;
