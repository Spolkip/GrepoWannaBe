import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import TextEditor from '../shared/TextEditor';
import { parseBBCode } from '../../utils/bbcodeParser';
import './AllianceForum.css';

// #comment a simple confirmation modal
const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center border border-gray-600 text-white">
            <p className="mb-6 text-lg">{message}</p>
            <div className="flex justify-center space-x-4">
                <button onClick={onCancel} className="forum-btn">Cancel</button>
                <button onClick={onConfirm} className="forum-btn">Confirm</button>
            </div>
        </div>
    </div>
);

const AllianceForum = ({ onClose }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, playerAlliance } = useGame();
    
    // state management for forums, threads, and posts
    const [forums, setForums] = useState([]);
    const [selectedForum, setSelectedForum] = useState(null);
    const [threads, setThreads] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [posts, setPosts] = useState([]);

    // state for UI toggles and form inputs
    const [newForumName, setNewForumName] = useState('');
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [newPostContent, setNewPostContent] = useState('');
    const [isCreatingForum, setIsCreatingForum] = useState(false);
    const [isCreatingThread, setIsCreatingThread] = useState(false);
    const [editingPostId, setEditingPostId] = useState(null);
    const [editingPostContent, setEditingPostContent] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const postsEndRef = useRef(null);

    const isLeader = currentUser?.uid === playerAlliance?.leader?.uid;

    // fetch forum categories (tabs)
    useEffect(() => {
        if (!worldId || !playerAlliance) return;
        const forumsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums');
        const q = query(forumsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const forumsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setForums(forumsData);
            if (!selectedForum && forumsData.length > 0) {
                setSelectedForum(forumsData[0]);
            }
        });
        return () => unsubscribe();
    }, [worldId, playerAlliance, selectedForum]);

    // fetch threads for the selected forum
    useEffect(() => {
        if (!selectedForum) return;
        const threadsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads');
        const q = query(threadsRef, orderBy('lastReplyAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [selectedForum, worldId, playerAlliance]);

    // fetch posts for the selected thread
    useEffect(() => {
        if (!selectedThread) {
            setPosts([]);
            return;
        }
        const postsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [selectedThread, selectedForum, worldId, playerAlliance]);

    useEffect(() => {
        postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [posts]);

    // handle creation of a new forum tab
    const handleCreateForum = async (e) => {
        e.preventDefault();
        if (!newForumName.trim() || !isLeader) return;
        const forumsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums');
        await addDoc(forumsRef, {
            name: newForumName,
            createdAt: serverTimestamp(),
        });
        setNewForumName('');
        setIsCreatingForum(false);
    };

    // handle creation of a new thread within a forum
    const handleCreateThread = async (e) => {
        e.preventDefault();
        if (!newThreadTitle.trim() || !newPostContent.trim() || !selectedForum) return;

        const threadsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads');
        const newThreadRef = doc(threadsRef);
        
        await setDoc(newThreadRef, {
            title: newThreadTitle,
            creatorId: currentUser.uid,
            creatorUsername: userProfile.username,
            createdAt: serverTimestamp(),
            lastReplyAt: serverTimestamp(),
            lastReplyBy: userProfile.username,
            replyCount: 0,
        });

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

    // handle replying to a thread
    const handleReply = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() || !selectedThread) return;

        const threadRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id);
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

    // handle deleting a post
    const handleDeletePost = (postId) => {
        setConfirmAction({
            message: "Are you sure you want to delete this post?",
            onConfirm: async () => {
                if (!selectedThread) return;
                const postRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id, 'posts', postId);
                await deleteDoc(postRef);
                setConfirmAction(null);
            }
        });
    };

    // handle starting to edit a post
    const handleStartEdit = (post) => {
        setEditingPostId(post.id);
        setEditingPostContent(post.content);
    };

    // handle canceling an edit
    const handleCancelEdit = () => {
        setEditingPostId(null);
        setEditingPostContent('');
    };

    // handle submitting an updated post
    const handleUpdatePost = async (e) => {
        e.preventDefault();
        if (!editingPostContent.trim() || !editingPostId) return;

        const postRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id, 'posts', editingPostId);
        await updateDoc(postRef, {
            content: editingPostContent,
            editedAt: serverTimestamp(),
        });

        handleCancelEdit();
    };

    const renderContent = () => {
        if (isCreatingThread) {
            return (
                 <div className="p-4">
                    <h3 className="forum-header -m-4 mb-4 p-2">Create New Thread in {selectedForum?.name}</h3>
                    <form onSubmit={handleCreateThread} className="space-y-3">
                        <input type="text" value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} placeholder="Thread Title" className="w-full bg-yellow-50/50 p-2 rounded border border-yellow-800/50 text-gray-800" />
                        <TextEditor value={newPostContent} onChange={setNewPostContent} />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsCreatingThread(false)} className="forum-btn">Cancel</button>
                            <button type="submit" className="forum-btn">Create</button>
                        </div>
                    </form>
                </div>
            );
        }

        if (selectedThread) {
            return (
                 <div className="flex flex-col h-full">
                    <div className="forum-header -m-6 mb-4 p-2 flex items-center">
                        <button onClick={() => setSelectedThread(null)} className="text-yellow-300 hover:text-white mr-4 text-sm">{'< Back'}</button>
                        <span className="font-bold">{selectedThread.title}</span>
                    </div>
                    <div className="space-y-4 mb-4 flex-grow overflow-y-auto p-2">
                        {posts.map(post => (
                            <div key={post.id} className="post-item">
                                <p className="post-author">{post.authorUsername}</p>
                                {editingPostId === post.id ? (
                                    <form onSubmit={handleUpdatePost}>
                                        <TextEditor value={editingPostContent} onChange={setEditingPostContent} />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button type="button" onClick={handleCancelEdit} className="forum-btn">Cancel</button>
                                            <button type="submit" className="forum-btn">Save</button>
                                        </div>
                                    </form>
                                ) : (
                                    <>
                                        <div className="post-content" dangerouslySetInnerHTML={{ __html: parseBBCode(post.content) }} />
                                        <div className="flex justify-between items-center">
                                            <p className="post-timestamp">
                                                {post.createdAt?.toDate().toLocaleString()}
                                                {post.editedAt && <em className="ml-2">(edited)</em>}
                                            </p>
                                            {currentUser.uid === post.authorId && (
                                                <div className="post-actions">
                                                    <button onClick={() => handleStartEdit(post)} className="post-action-btn">Edit</button>
                                                    <button onClick={() => handleDeletePost(post.id)} className="post-action-btn">Delete</button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        <div ref={postsEndRef} />
                    </div>
                    <form onSubmit={handleReply} className="mt-auto flex-shrink-0 p-2 reply-form">
                        <TextEditor value={newPostContent} onChange={setNewPostContent} />
                        <div className="flex justify-end mt-2">
                            <button type="submit" className="forum-btn">Post Reply</button>
                        </div>
                    </form>
                </div>
            );
        }

        return (
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
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            {confirmAction && (
                <ConfirmationModal 
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <div className="forum-container w-full max-w-5xl h-5/6 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center">
                    <h2 className="font-title text-3xl">Alliance Forum</h2>
                    <button onClick={onClose} className="text-3xl leading-none hover:text-red-700">&times;</button>
                </div>
                <div className="forum-tabs-container">
                    {forums.map(forum => (
                        <button key={forum.id} onClick={() => setSelectedForum(forum)} className={`forum-tab ${selectedForum?.id === forum.id ? 'active' : ''}`}>
                            {forum.name}
                        </button>
                    ))}
                    {isLeader && (
                        isCreatingForum ? (
                            <form onSubmit={handleCreateForum} className="p-1 flex items-center">
                                <input type="text" value={newForumName} onChange={(e) => setNewForumName(e.target.value)} placeholder="New Forum Name" className="bg-white/20 text-white p-1 rounded text-sm" />
                                <button type="submit" className="ml-2 text-white text-xl">+</button>
                                <button type="button" onClick={() => setIsCreatingForum(false)} className="ml-1 text-white text-xl">x</button>
                            </form>
                        ) : (
                            <button onClick={() => setIsCreatingForum(true)} className="forum-tab new-forum-btn">+</button>
                        )
                    )}
                </div>
                <div className="overflow-y-auto flex-grow p-4">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default AllianceForum;
