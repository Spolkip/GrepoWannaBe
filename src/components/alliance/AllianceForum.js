import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import './AllianceForum.css';

const AllianceForum = ({ onClose }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, playerAlliance } = useGame();
    const [threads, setThreads] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [posts, setPosts] = useState([]);
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [newPostContent, setNewPostContent] = useState('');
    const [isCreatingThread, setIsCreatingThread] = useState(false);
    const postsEndRef = useRef(null);

    // #comment fetch forum threads, ordered by the most recent reply
    useEffect(() => {
        if (!worldId || !playerAlliance) return;
        const threadsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forumThreads');
        const q = query(threadsRef, orderBy('lastReplyAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [worldId, playerAlliance]);

    // #comment fetch posts for a selected thread, ordered by creation time
    useEffect(() => {
        if (!selectedThread) {
            setPosts([]);
            return;
        }
        const postsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forumThreads', selectedThread.id, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [selectedThread, worldId, playerAlliance]);

    useEffect(() => {
        postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [posts]);

    // #comment handle creating a new thread and its initial post
    const handleCreateThread = async (e) => {
        e.preventDefault();
        if (!newThreadTitle.trim() || !newPostContent.trim()) return;

        const threadsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forumThreads');
        const newThreadRef = doc(threadsRef);
        
        const threadData = {
            title: newThreadTitle,
            creatorId: currentUser.uid,
            creatorUsername: userProfile.username,
            createdAt: serverTimestamp(),
            lastReplyAt: serverTimestamp(),
            lastReplyBy: userProfile.username,
            replyCount: 0,
        };
        
        await setDoc(newThreadRef, threadData);

        const postsRef = collection(newThreadRef, 'posts');
        await addDoc(postsRef, {
            content: newPostContent,
            authorId: currentUser.uid,
            authorUsername: userProfile.username,
            createdAt: serverTimestamp(),
        });

        setNewThreadTitle('');
        setNewPostContent('');
        setIsCreatingThread(false);
    };

    // #comment handle replying to an existing thread
    const handleReply = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() || !selectedThread) return;

        const threadRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forumThreads', selectedThread.id);
        const postsRef = collection(threadRef, 'posts');

        await addDoc(postsRef, {
            content: newPostContent,
            authorId: currentUser.uid,
            authorUsername: userProfile.username,
            createdAt: serverTimestamp(),
        });

        await updateDoc(threadRef, {
            lastReplyAt: serverTimestamp(),
            lastReplyBy: userProfile.username,
            replyCount: (selectedThread.replyCount || 0) + 1,
        });

        setNewPostContent('');
    };

    const renderThreadList = () => (
        <div>
            <table className="forum-table">
                <thead>
                    <tr>
                        <th className="w-2/3">Theme</th>
                        <th className="text-center">Replies</th>
                        <th>Last Post</th>
                    </tr>
                </thead>
                <tbody>
                    {threads.map(thread => (
                        <tr key={thread.id} onClick={() => setSelectedThread(thread)}>
                            <td>
                                <p className="font-bold">{thread.title}</p>
                                <p className="text-xs">by {thread.creatorUsername} on {thread.createdAt?.toDate().toLocaleDateString()}</p>
                            </td>
                            <td className="text-center">{thread.replyCount || 0}</td>
                            <td>
                                <p className="font-bold text-sm">{thread.lastReplyBy}</p>
                                <p className="text-xs">{thread.lastReplyAt?.toDate().toLocaleString()}</p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="mt-4 flex justify-start gap-4">
                <button onClick={() => setIsCreatingThread(true)} className="forum-btn">New Thread</button>
            </div>
        </div>
    );

    const renderCreateThread = () => (
        <div className="p-4">
            <h3 className="forum-header -m-4 mb-4 p-2">Create New Thread</h3>
            <form onSubmit={handleCreateThread} className="space-y-3">
                <input
                    type="text"
                    value={newThreadTitle}
                    onChange={(e) => setNewThreadTitle(e.target.value)}
                    placeholder="Thread Title"
                    className="w-full bg-yellow-50/50 p-2 rounded border border-yellow-800/50 text-gray-800"
                />
                <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Your post content..."
                    className="w-full bg-yellow-50/50 p-2 rounded h-48 border border-yellow-800/50 text-gray-800"
                />
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsCreatingThread(false)} className="forum-btn">Cancel</button>
                    <button type="submit" className="forum-btn">Create</button>
                </div>
            </form>
        </div>
    );

    const renderThreadView = () => (
        <div className="flex flex-col h-full">
            <div className="forum-header -m-6 mb-4 p-2 flex items-center">
                <button onClick={() => setSelectedThread(null)} className="text-yellow-300 hover:text-white mr-4 text-sm">{'< Back'}</button>
                <span className="font-bold">{selectedThread.title}</span>
            </div>
            <div className="space-y-4 mb-4 flex-grow overflow-y-auto p-2">
                {posts.map(post => (
                    <div key={post.id} className="post-item">
                        <p className="post-author">{post.authorUsername}</p>
                        <p className="post-content">{post.content}</p>
                        <p className="post-timestamp">{post.createdAt?.toDate().toLocaleString()}</p>
                    </div>
                ))}
                <div ref={postsEndRef} />
            </div>
            <form onSubmit={handleReply} className="mt-auto flex-shrink-0 p-2 reply-form">
                <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Write a reply..."
                />
                <div className="flex justify-end mt-2">
                    <button type="submit" className="forum-btn">Post Reply</button>
                </div>
            </form>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="forum-container w-full max-w-5xl h-5/6 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center">
                    <h2 className="font-title text-3xl">Alliance Forum</h2>
                    <button onClick={onClose} className="text-3xl leading-none hover:text-red-700">&times;</button>
                </div>
                <div className="overflow-y-auto flex-grow p-4">
                    {isCreatingThread ? renderCreateThread() : (selectedThread ? renderThreadView() : renderThreadList())}
                </div>
            </div>
        </div>
    );
};

export default AllianceForum;
