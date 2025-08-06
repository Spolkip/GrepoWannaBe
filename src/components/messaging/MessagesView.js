// src/components/messaging/MessagesView.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, setDoc, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { parseBBCode } from '../../utils/bbcodeParser';
import './MessagesView.css';

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

    // #comment Autocomplete states
    const [allPlayers, setAllPlayers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);

    // #comment Fetch all players for autocomplete
    useEffect(() => {
        const fetchPlayers = async () => {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            const players = snapshot.docs
                .map(doc => doc.data().username)
                .filter(username => username !== userProfile.username); // Exclude self
            setAllPlayers(players);
        };
        fetchPlayers();
    }, [userProfile.username]);

    const handleCompose = useCallback(async (recipientId = null, recipientUsername = null) => {
        if (recipientId && recipientUsername) {
            // #comment Check if a conversation already exists
            const convoQuery = query(
                collection(db, 'worlds', worldId, 'conversations'),
                where('participants', 'in', [[currentUser.uid, recipientId], [recipientId, currentUser.uid]])
            );
            const convoSnapshot = await getDocs(convoQuery);
            if (!convoSnapshot.empty) {
                setSelectedConversation({ id: convoSnapshot.docs[0].id, ...convoSnapshot.docs[0].data() });
                setIsComposing(false);
                return;
            }
        }
        setSelectedConversation(null);
        setIsComposing(true);
        if (recipientUsername) {
            setNewRecipient(recipientUsername);
        }
    }, [currentUser, worldId]);

    useEffect(() => {
        if (!currentUser || !worldId) return;

        const conversationsQuery = query(
            collection(db, 'worlds', worldId, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );

        const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
            const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // #comment Sort conversations by the most recent message
            convos.sort((a, b) => (b.lastMessage?.timestamp?.toDate() || 0) - (a.lastMessage?.timestamp?.toDate() || 0));
            setConversations(convos);
        });

        return () => unsubscribe();
    }, [currentUser, worldId]);

    useEffect(() => {
        if (initialRecipientId && initialRecipientUsername) {
            handleCompose(initialRecipientId, initialRecipientUsername);
        }
    }, [initialRecipientId, initialRecipientUsername, handleCompose]);

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

            // #comment Mark conversation as read
            const convoRef = doc(db, 'worlds', worldId, 'conversations', selectedConversation.id);
            updateDoc(convoRef, {
                readBy: arrayUnion(currentUser.uid)
            });


            return () => unsubscribe();
        }
    }, [selectedConversation, worldId, currentUser.uid]);

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
        
        if (isComposing) {
            const recipientQuery = query(collection(db, 'users'), where('username', '==', newRecipient));
            const recipientSnapshot = await getDocs(recipientQuery);
            if (recipientSnapshot.empty) {
                alert('Recipient not found.');
                return;
            }
            const recipientData = recipientSnapshot.docs[0].data();
            const recipientId = recipientSnapshot.docs[0].id;
            
            if (recipientId === currentUser.uid) {
                alert("You cannot send a message to yourself.");
                return;
            }

            const convoQuery = query(
                collection(db, 'worlds', worldId, 'conversations'),
                where('participants', 'in', [[currentUser.uid, recipientId], [recipientId, currentUser.uid]])
            );
            const convoSnapshot = await getDocs(convoQuery);

            if (convoSnapshot.empty) {
                const newConvoRef = doc(collection(db, 'worlds', worldId, 'conversations'));
                await setDoc(newConvoRef, {
                    participants: [currentUser.uid, recipientId],
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
        }

        const convoRef = doc(db, 'worlds', worldId, 'conversations', conversationId);
        await addDoc(collection(convoRef, 'messages'), {
            text: newMessage,
            senderId: currentUser.uid,
            senderUsername: userProfile.username,
            timestamp: serverTimestamp(),
        });

        await updateDoc(convoRef, {
            lastMessage: {
                text: newMessage,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
            },
            readBy: [currentUser.uid],
        });

        setNewMessage('');
        if (isComposing) {
            setIsComposing(false);
            setNewRecipient('');
            const newConvo = await getDoc(convoRef);
            setSelectedConversation({ id: newConvo.id, ...newConvo.data() });
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
    
    // #comment Handle input change for autocomplete
    const handleRecipientChange = (e) => {
        const value = e.target.value;
        setNewRecipient(value);
        if (value.length > 0) {
            const filteredSuggestions = allPlayers.filter(player =>
                player.toLowerCase().startsWith(value.toLowerCase())
            );
            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions([]);
        }
    };

    // #comment Handle clicking a suggestion
    const handleSuggestionClick = (username) => {
        setNewRecipient(username);
        setSuggestions([]);
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
                            {conversations.map(convo => {
                                const isUnread = convo.lastMessage?.senderId !== currentUser.uid && !convo.readBy.includes(currentUser.uid);
                                return (
                                <li
                                    key={convo.id}
                                    className={`papyrus-list-item ${selectedConversation?.id === convo.id ? 'selected' : ''} ${isUnread ? 'font-bold' : ''}`}
                                    onClick={() => handleSelectConversation(convo)}
                                >
                                    <p className="font-title text-lg">{getOtherParticipant(convo)}</p>
                                    <p className="text-sm truncate">{convo.lastMessage?.text}</p>
                                </li>
                            )})}
                        </ul>
                    </div>
                    
                    <div className="w-2/3 flex flex-col">
                        {selectedConversation || isComposing ? (
                            <>
                                <div className="p-4 border-b-2 border-[#8B4513] autocomplete-suggestions-container">
                                    {isComposing ? (
                                        <div>
                                            <input
                                                type="text"
                                                value={newRecipient}
                                                onChange={handleRecipientChange}
                                                placeholder="Scribe the recipient's name..."
                                                className="w-full papyrus-input text-lg"
                                                autoComplete="off"
                                            />
                                            {suggestions.length > 0 && (
                                                <ul className="autocomplete-suggestions-list light">
                                                    {suggestions.map(player => (
                                                        <li key={player} onClick={() => handleSuggestionClick(player)}>
                                                            {player}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
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
