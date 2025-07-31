import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import './Chat.css';

const Chat = ({ worldId }) => {
    const { currentUser } = useAuth();
    const { gameState } = useGame();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!worldId) return;

        const q = query(collection(db, 'worlds', worldId, 'chat'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = [];
            querySnapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() });
            });
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [worldId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !worldId || !currentUser || !gameState) return;

        const { uid, displayName } = currentUser;
        const { ownerUsername } = gameState; // Using ownerUsername from gameState as player name

        await addDoc(collection(db, 'worlds', worldId, 'chat'), {
            text: newMessage,
            timestamp: serverTimestamp(),
            uid,
            authorName: ownerUsername || displayName, // Fallback to displayName
        });

        setNewMessage('');
    };

    return (
        <div className="chat-window">
            <div className="messages-container">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.uid === currentUser.uid ? 'sent' : 'received'}`}>
                        <span className="author">{msg.authorName}:</span>
                        <p>{msg.text}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="send-message-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;
