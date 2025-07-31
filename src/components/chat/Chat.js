import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import './Chat.css';

const Chat = ({ worldId, isVisible, onClose }) => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    // Draggable state
    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 540 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const chatWindowRef = useRef(null);


    useEffect(() => {
        if (!worldId) return;

        const q = query(collection(db, 'worlds', worldId, 'chat'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [worldId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !worldId || !currentUser || !userProfile) return;

        await addDoc(collection(db, 'worlds', worldId, 'chat'), {
            text: newMessage,
            timestamp: serverTimestamp(),
            uid: currentUser.uid,
            authorName: userProfile.username,
        });

        setNewMessage('');
    };
    
    const handleMouseDown = (e) => {
        if (e.target.classList.contains('chat-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart, setPosition]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);


    if (!isVisible) return null;

    return (
        <div 
            className="chat-window" 
            ref={chatWindowRef}
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
        >
            <div className="chat-header" onMouseDown={handleMouseDown}>
                <h4>World Chat</h4>
                <button onClick={onClose} className="close-btn">&times;</button>
            </div>
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
