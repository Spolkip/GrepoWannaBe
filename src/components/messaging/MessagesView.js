import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { parseBBCode } from '../../utils/bbcodeParser';
import './MessagesView.css'; // Import the new CSS file

const MessagesView = ({ onClose, initialRecipientId = null, initialRecipientUsername = null, onActionClick }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId } = useGame();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [newRecipient, setNewRecipient] = useState('');
    const [isComposing, setIsComposing] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!currentUser) return;

        const conversationsQuery = query(
            collection(db, 'worlds', worldId, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );

        const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
            const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setConversations(convos);
        });

        return () => unsubscribe();
    }, [currentUser, worldId]);

    useEffect(() => {
        if (initialRecipientId && initialRecipientUsername) {
            handleCompose(initialRecipientId, initialRecipientUsername);
        }
    }, [initialRecipientId, initialRecipientUsername]);

    useEffect(() => {
        if (selectedConversation) {
            const messagesQuery = query(
                collection(db, 'worlds', worldId, 'conversations', selectedConversation.id, 'messages'),
                orderBy('timestamp', 'asc')
            );

            const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
                const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMessages(msgs);
            });

            return () => unsubscribe();
        }
    }, [selectedConversation, worldId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSelectConversation = async (convo) => {
        setSelectedConversation(convo);
        setIsComposing(false);
    };

    const handleSendMessage = async () => {
        if (newMessage.trim() === '' || (!selectedConversation && !newRecipient)) return;

        let conversationId = selectedConversation?.id;
        // Removed: let participants = selectedConversation?.participants;

        if (isComposing) {
            const recipientQuery = query(collection(db, 'users'), where('username', '==', newRecipient));
            const recipientSnapshot = await getDocs(recipientQuery);
            if (recipientSnapshot.empty) {
                alert('Recipient not found.');
                return;
            }
            const recipientData = recipientSnapshot.docs[0].data();
            const recipientId = recipientSnapshot.docs[0].id;

            const convoQuery = query(
                collection(db, 'worlds', worldId, 'conversations'),
                where('participants', '==', [currentUser.uid, recipientId].sort())
            );
            const convoSnapshot = await getDocs(convoQuery);

            if (convoSnapshot.empty) {
                const newConvoRef = doc(collection(db, 'worlds', worldId, 'conversations'));
                await setDoc(newConvoRef, {
                    participants: [currentUser.uid, recipientId].sort(),
                    participantUsernames: {
                        [currentUser.uid]: userProfile.username,
                        [recipientId]: recipientData.username,
                    },
                    lastMessage: {
                        text: newMessage,
                        senderId: currentUser.uid,
                        timestamp: serverTimestamp(),
                    },
                    readBy: [currentUser.uid],
                });
                conversationId = newConvoRef.id;
            } else {
                conversationId = convoSnapshot.docs[0].id;
            }
            // Removed: participants = [currentUser.uid, recipientId];
        }

        const convoRef = doc(db, 'worlds', worldId, 'conversations', conversationId);
        await addDoc(collection(convoRef, 'messages'), {
            text: newMessage,
            senderId: currentUser.uid,
            senderUsername: userProfile.username,
            timestamp: serverTimestamp(),
        });

        await setDoc(convoRef, {
            lastMessage: {
                text: newMessage,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
            },
            readBy: [currentUser.uid],
        }, { merge: true });

        setNewMessage('');
        if (isComposing) {
            setIsComposing(false);
            setNewRecipient('');
            const newConvo = await getDoc(convoRef);
            setSelectedConversation({ id: newConvo.id, ...newConvo.data() });
        }
    };

    const handleCompose = (recipientId = null, recipientUsername = null) => {
        setSelectedConversation(null);
        setIsComposing(true);
        if (recipientId && recipientUsername) {
            setNewRecipient(recipientUsername);
        }
    };

    const getOtherParticipant = (convo) => {
        const otherId = convo.participants.find(p => p !== currentUser.uid);
        return convo.participantUsernames[otherId] || 'Unknown';
    };

    const handleContentClick = (e) => {
        const target = e.target;
        if (target.classList.contains('bbcode-action')) {
            const actionType = target.dataset.actionType;
            const actionId = target.dataset.actionId;
            if (actionType && actionId && onActionClick) {
                onActionClick(actionType, actionId);
                onClose();
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="papyrus-bg papyrus-text w-full max-w-4xl h-3/4 flex flex-col rounded-lg">
                <div className="p-4 border-b-2 border-[#8B4513] flex justify-between items-center">
                    <h2 className="papyrus-header">Missives & Scrolls</h2>
                    <button onClick={onClose} className="papyrus-text text-3xl font-bold hover:text-red-700">&times;</button>
                </div>

                <div className="flex flex-grow overflow-hidden">
                    <div className="w-1/3 border-r-2 border-[#8B4513] flex flex-col">
                        <div className="p-2 border-b-2 border-[#8B4513]">
                            <button onClick={() => handleCompose()} className="w-full papyrus-btn">
                                New Scroll
                            </button>
                        </div>
                        <ul className="overflow-y-auto">
                            {conversations.map(convo => (
                                <li
                                    key={convo.id}
                                    className={`papyrus-list-item ${selectedConversation?.id === convo.id ? 'selected' : ''}`}
                                    onClick={() => handleSelectConversation(convo)}
                                >
                                    <p className="font-bold font-title text-lg">{getOtherParticipant(convo)}</p>
                                    <p className="text-sm truncate">{convo.lastMessage?.text}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div className="w-2/3 flex flex-col">
                        {selectedConversation || isComposing ? (
                            <>
                                <div className="p-4 border-b-2 border-[#8B4513]">
                                    {isComposing ? (
                                        <input
                                            type="text"
                                            value={newRecipient}
                                            onChange={(e) => setNewRecipient(e.target.value)}
                                            placeholder="Scribe the recipient's name..."
                                            className="w-full papyrus-input text-lg"
                                        />
                                    ) : (
                                        <h3 className="font-bold text-lg font-title">{getOtherParticipant(selectedConversation)}</h3>
                                    )}
                                </div>
                                <div className="flex-grow overflow-y-auto p-4 space-y-4" onClick={handleContentClick}>
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`${msg.senderId === currentUser.uid ? 'papyrus-message-sent' : 'papyrus-message-received'}`}>
                                                <p className="font-bold text-sm font-title">{msg.senderUsername}</p>
                                                <div dangerouslySetInnerHTML={{ __html: parseBBCode(msg.text) }} />
                                                <p className="text-xs text-gray-700/70 mt-1 text-right">{msg.timestamp?.toDate().toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 border-t-2 border-[#8B4513]">
                                    <div className="flex">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                            className="flex-grow papyrus-input"
                                            placeholder="Write your message..."
                                        />
                                        <button onClick={handleSendMessage} className="papyrus-btn ml-2">Send</button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500 italic">Select a conversation or start a new one.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessagesView;
